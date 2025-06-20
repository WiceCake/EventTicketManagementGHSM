<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { QrCodeIcon, CameraIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { QrcodeStream } from 'vue-qrcode-reader'
// import { QrcodeStream } from 'vue3-qr-barcode-scanner'

const isCameraActive = ref(false)
const loading = ref(false)
const processing = ref(false)
const manualTicketId = ref('')
const scannerContainer = ref(null)
const lastScanResult = ref(null)
const recentScans = ref([])
const stats = ref({
  totalScanned: 0,
  validTickets: 0,
  invalidTickets: 0
})
const activeEvent = ref(null)
const toast = ref({ show: false, message: '', success: true })

async function fetchActiveEvent() {
  const { data } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (data) activeEvent.value = data
}

async function fetchScanStats() {
  if (!activeEvent.value) return

  // Only 'scanned' and 'invalid' actions for this event
  const { count: totalScanned } = await supabase
    .from('ticket_logs')
    .select('id, tickets!inner(event_id)', { count: 'exact', head: true })
    .in('action', ['scanned', 'invalid'])
    .eq('tickets.event_id', activeEvent.value.id)

  const { count: validTickets } = await supabase
    .from('ticket_logs')
    .select('id, tickets!inner(event_id)', { count: 'exact', head: true })
    .eq('action', 'scanned')
    .eq('tickets.event_id', activeEvent.value.id)

  const { count: invalidTickets } = await supabase
    .from('ticket_logs')
    .select('id, tickets!inner(event_id)', { count: 'exact', head: true })
    .eq('action', 'invalid')
    .eq('tickets.event_id', activeEvent.value.id)

  stats.value = {
    totalScanned: totalScanned || 0,
    validTickets: validTickets || 0,
    invalidTickets: invalidTickets || 0
  }

  // Recent scans: only 'scanned' and 'invalid'
  const { data: logs } = await supabase
    .from('ticket_logs')
    .select('*, tickets!inner(event_id, name)')
    .in('action', ['scanned', 'invalid'])
    .eq('tickets.event_id', activeEvent.value.id)
    .order('created_at', { ascending: false })
    .limit(10)

  recentScans.value = (logs || []).map(log => ({
    id: log.id,
    ticketId: log.ticket_id,
    status: log.action,
    attendeeName: log.tickets?.name || '',
    timestamp: new Date(log.created_at),
    success: log.action === 'scanned'
  }))
}

// Scanner logic (pseudo, replace with real QR scanner library)
const startCamera = async () => { isCameraActive.value = true }
const stopCamera = async () => { isCameraActive.value = false }
const toggleCamera = async () => {
  loading.value = true
  if (isCameraActive.value) await stopCamera()
  else await startCamera()
  loading.value = false
}

function showToast(message, success = true) {
  toast.value = { show: true, message, success }
  setTimeout(() => { toast.value.show = false }, 2500)
}

// Process scanned or manually entered ticket
async function processTicket(ticketInput) {
  let ticket = null;
  // Try by manual_code first
  const { data: byCode } = await supabase
    .from('tickets')
    .select('*')
    .eq('manual_code', ticketInput)
    .maybeSingle();
  if (byCode) {
    ticket = byCode;
  } else {
    // Try by id (UUID)
    const { data: byId } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketInput)
      .maybeSingle();
    if (byId) ticket = byId;
  }

  if (!ticket) {
    await supabase.from('ticket_logs').insert({
      ticket_id: ticketInput,
      action: 'invalid',
      notes: 'Ticket not found'
    })
    lastScanResult.value = {
      ticketId: ticketInput,
      attendeeName: '',
      timestamp: new Date(),
      success: false,
      message: 'Ticket not found.'
    }
    showToast('Ticket not found.', false)
    await fetchScanStats()
    return
  }

  if (ticket.status === 'scanned') {
    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      action: 'invalid', // log as invalid for stats
      notes: 'Ticket already scanned.'
    })
    lastScanResult.value = {
      ticketId: ticket.manual_code || ticket.id,
      attendeeName: ticket.name || '',
      timestamp: new Date(),
      success: false,
      message: 'Ticket already scanned.'
    }
    showToast('Ticket already scanned.', false)
    await fetchScanStats()
    return
  }

  if (ticket.status === 'unclaimed') {
    await supabase.from('ticket_logs').insert({
      ticket_id: ticket.id,
      action: 'invalid', // log as invalid for stats
      notes: 'Ticket not yet claimed.'
    })
    lastScanResult.value = {
      ticketId: ticket.manual_code || ticket.id,
      attendeeName: ticket.name || '',
      timestamp: new Date(),
      success: false,
      message: 'Ticket not yet claimed.'
    }
    showToast('Ticket not yet claimed.', false)
    await fetchScanStats()
    return
  }

  // Mark as scanned
  const now = new Date().toISOString()
  await supabase
    .from('tickets')
    .update({
      scanned_at: now,
      status: 'scanned'
    })
    .eq('id', ticket.id)
  await supabase.from('ticket_logs').insert({
    ticket_id: ticket.id,
    action: 'checkin', // log as checkin for stats
    notes: 'Ticket scanned at event'
  })
  lastScanResult.value = {
    ticketId: ticket.manual_code || ticket.id,
    attendeeName: ticket.name || '',
    timestamp: new Date(),
    success: true,
    message: 'Ticket successfully scanned.'
  }
  showToast('Ticket successfully scanned.', true)
  await fetchScanStats()
}

// Manual entry
function processManualTicket() {
  if (!manualTicketId.value.trim()) return
  processTicket(manualTicketId.value.trim().toUpperCase())
  manualTicketId.value = ''
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

onMounted(async () => {
  await fetchActiveEvent()
  await fetchScanStats()
})

function onDetect([result]) {
  let ticketId = result?.rawValue || result
  // If ticketId is a JSON string, parse it
  try {
    const parsed = JSON.parse(ticketId)
    if (parsed && parsed.id) ticketId = parsed.id
  } catch (e) {
    // Not JSON, use as is
  }
  processTicket(ticketId)
  stopCamera()
}

function onManualCodeInput(e) {
  manualTicketId.value = e.target.value.toUpperCase()
}
</script>

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-base font-semibold transition-all', toast.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white']" style="transform: translateX(-50%); min-width: 220px;">
      {{ toast.message }}
    </div>
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Left: Scanner Section -->
        <div class="w-full lg:w-[400px] flex-shrink-0">
          <div class="bg-[#232b3b] rounded-2xl shadow-2xl border border-blue-700 p-8 flex flex-col gap-6 min-h-[520px]">
            <div class="flex items-center justify-between mb-2">
              <h1 class="text-3xl font-extrabold text-white tracking-tight">Scan Ticket</h1>
              <button
                @click="toggleCamera"
                :disabled="loading"
                :class="[ 'px-5 py-2 rounded-lg font-semibold text-base transition-colors duration-200',
                  isCameraActive 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white',
                  loading && 'opacity-50 cursor-not-allowed'
                ]"
              >
                <span v-if="loading">Loading...</span>
                <span v-else>{{ isCameraActive ? 'Stop Camera' : 'Start Camera' }}</span>
              </button>
            </div>
            <!-- Camera Container -->
            <div class="relative bg-[#181f2a] rounded-xl overflow-hidden mb-2 border border-blue-900">
              <QrcodeStream
                v-if="isCameraActive"
                @detect="onDetect"
                :paused="processing"
                class="aspect-video"
              />
              <div v-else class="aspect-video flex items-center justify-center text-gray-500">
                <div class="text-center">
                  <CameraIcon class="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p class="text-lg font-medium text-gray-300">Camera Inactive</p>
                  <p class="text-sm text-gray-500">Click "Start Camera" to begin scanning</p>
                </div>
              </div>
            </div>
            <!-- Manual Input -->
            <div>
              <input
                v-model="manualTicketId"
                type="text"
                placeholder="Enter ticket ID manually"
                class="w-full px-4 py-2 border border-gray-700 rounded-md text-base bg-[#181f2a] text-white focus:ring-blue-500 focus:border-blue-500"
                @keyup.enter="processManualTicket"
                :disabled="processing"
                @input="onManualCodeInput"
              />
              <button
                @click="processManualTicket"
                :disabled="!manualTicketId.trim() || processing"
                class="w-full mt-3 px-4 py-2 bg-blue-600 text-white text-base rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Process
              </button>
            </div>
            <!-- Scan Result (removed persistent card) -->
          </div>
        </div>

        <!-- Right: Stats and Recent Scans -->
        <div class="w-full flex-1 flex flex-col gap-6">
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-blue-700 p-5 flex items-center min-h-[90px]">
              <div class="p-2 rounded-full bg-blue-900">
                <QrCodeIcon class="w-6 h-6 text-blue-400" />
              </div>
              <div class="ml-3">
                <p class="text-xs font-medium text-blue-300">Total Scanned</p>
                <p class="text-xl font-extrabold text-white">{{ stats.totalScanned }}</p>
              </div>
            </div>
            <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-green-700 p-5 flex items-center min-h-[90px]">
              <div class="p-2 rounded-full bg-green-900">
                <CheckCircleIcon class="w-6 h-6 text-green-400" />
              </div>
              <div class="ml-3">
                <p class="text-xs font-medium text-green-300">Valid Tickets</p>
                <p class="text-xl font-extrabold text-white">{{ stats.validTickets }}</p>
              </div>
            </div>
            <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-red-700 p-5 flex items-center min-h-[90px]">
              <div class="p-2 rounded-full bg-red-900">
                <XCircleIcon class="w-6 h-6 text-red-400" />
              </div>
              <div class="ml-3">
                <p class="text-xs font-medium text-red-300">Invalid Tickets</p>
                <p class="text-xl font-extrabold text-white">{{ stats.invalidTickets }}</p>
              </div>
            </div>
          </div>
          <!-- Recent Scans -->
          <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-blue-700 p-6 flex-1 flex flex-col">
            <h2 class="text-xl font-bold text-white mb-4">Recent Scans</h2>
            <div class="space-y-3 max-h-80 overflow-y-auto flex-1">
              <div
                v-for="scan in recentScans"
                :key="scan.id"
                :class=" [
                  'p-4 rounded-lg border text-base',
                  scan.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                ]"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-semibold text-gray-900">{{ scan.ticketId }}</p>
                    <p v-if="scan.attendeeName" class="text-gray-600">{{ scan.attendeeName }}</p>
                  </div>
                  <div class="text-right">
                    <div
                      :class=" [
                        'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold',
                        scan.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      ]"
                    >
                      {{ scan.success ? 'Valid' : 'Invalid' }}
                    </div>
                    <p class="text-xs text-gray-500 mt-1">{{ formatTime(scan.timestamp) }}</p>
                  </div>
                </div>
              </div>
              <div v-if="recentScans.length === 0" class="text-center py-12 text-gray-500">
                <QrCodeIcon class="w-14 h-14 mx-auto mb-3 text-gray-300" />
                <p class="text-lg">No scans yet</p>
                <p class="text-base">Scan tickets will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-bg {
  background: linear-gradient(135deg, #181f2a 0%, #232b3b 100%);
  min-height: 100vh;
}
@keyframes scan {
  0% { top: 0; }
  50% { top: calc(100% - 4px); }
  100% { top: 0; }
}
.animate-scan {
  animation: scan 2s ease-in-out infinite;
}
.overflow-y-auto::-webkit-scrollbar { width: 4px; }
.overflow-y-auto::-webkit-scrollbar-track { background: #232b3b; border-radius: 2px; }
.overflow-y-auto::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
.overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>