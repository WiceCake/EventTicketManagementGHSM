<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import QRCode from 'qrcode'
import QRTicketCard from '../../components/QRTicketCard.vue'
import {
  PrinterIcon,
  DocumentArrowDownIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { useToast } from 'vue-toastification'

// State
const tickets = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const activeEvent = ref(null)
const showModal = ref(false)
const isBatch = ref(false)
const form = ref({
  recitalist_name: '',
  guest_count: 0,
})
const csvFile = ref(null)
const showPreviewModal = ref(false)
const selectedPerformerName = ref(null)
const previewTickets = ref([])
const previewMode = ref('batch') // 'batch' or 'single'
const singlePreviewTicket = ref(null)

const guestType = 'guest'
const recitalistType = 'recitalist'

// Group tickets by recitalist
const groupedTickets = computed(() => {
  const groups = {}
  tickets.value.forEach(ticket => {
    if (ticket.ticket_type === recitalistType) {
      groups[ticket.name] = { recitalist: ticket, guests: [] }
    }
  })
  tickets.value.forEach(ticket => {
    if (ticket.ticket_type === guestType && groups[ticket.created_by_name]) {
      groups[ticket.created_by_name].guests.push(ticket)
    }
  })
  return Object.values(groups)
})

function resetForm() {
  form.value = {
    recitalist_name: '',
    guest_count: 0,
  }
  csvFile.value = null
}

function openAddModal() {
  resetForm()
  isBatch.value = false
  showModal.value = true
}

function openBatchModal() {
  resetForm()
  isBatch.value = true
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

function closePreviewModal() {
  showPreviewModal.value = false
  previewTickets.value = []
  singlePreviewTicket.value = null
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchActiveEvent() {
  const { data, error: err } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle() // <-- Use maybeSingle instead of single

  if (err || !data) {
    error.value = 'No active event set. Please set an active event first.'
    activeEvent.value = null
  } else {
    activeEvent.value = data
    error.value = ''
  }
}

async function fetchTickets() {
  loading.value = true
  error.value = ''
  if (!activeEvent.value) {
    tickets.value = []
    loading.value = false
    return
  }
  const { data, error: err } = await supabase
    .from('tickets')
    .select('*')
    .eq('event_id', activeEvent.value.id)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else tickets.value = data
  loading.value = false
}

function generateManualCode(length = 7) {
  // Generates a random alphanumeric code, uppercase, no ambiguous chars
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function addRecitalist() {
  error.value = ''
  message.value = ''
  if (!activeEvent.value) {
    showToast('No active event set.', false)
    return
  }
  if (!form.value.recitalist_name) {
    showToast('Recitalist name is required.', false)
    return
  }
  // Generate unique manual code for recitalist
  let manualCode = generateManualCode();
  let exists = true;
  while (exists) {
    const { data: existing } = await supabase.from('tickets').select('id').eq('manual_code', manualCode).maybeSingle();
    if (!existing) exists = false;
    else manualCode = generateManualCode();
  }
  // Insert recitalist ticket
  const { data: recitalist, error: err1 } = await supabase
    .from('tickets')
    .insert({
      event_id: activeEvent.value.id,
      ticket_type: recitalistType,
      name: form.value.recitalist_name,
      created_by_name: form.value.recitalist_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      manual_code: manualCode
    })
    .select()
    .single()
  if (err1) {
    showToast(err1.message, false)
    return
  }
  // Insert guest tickets
  let guestTickets = []
  if (form.value.guest_count > 0) {
    let guestInserts = [];
    for (let i = 0; i < form.value.guest_count; i++) {
      // Generate unique manual code for each guest
      let guestCode = generateManualCode();
      let guestExists = true;
      while (guestExists) {
        const { data: existing } = await supabase.from('tickets').select('id').eq('manual_code', guestCode).maybeSingle();
        if (!existing) guestExists = false;
        else guestCode = generateManualCode();
      }
      guestInserts.push({
        event_id: activeEvent.value.id,
        ticket_type: guestType,
        name: null,
        created_by_name: form.value.recitalist_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        manual_code: guestCode
      });
    }
    const { error: err2 } = await supabase.from('tickets').insert(guestInserts)
    if (err2) {
      showToast(err2.message, false)
      return
    }
    guestTickets = guestInserts
  }
  showToast(`Recitalist and ${guestTickets.length} guest ticket(s) added!`, true)
  closeModal()
  await fetchTickets()
}

function parseCSV(text) {
  // Simple CSV parser: expects "recitalist_name,guest_count" per line
  const lines = text.trim().split('\n')
  const rows = []
  for (const line of lines) {
    const [recitalist_name, guest_count] = line.split(',').map(s => s.trim())
    if (recitalist_name && !isNaN(Number(guest_count))) {
      rows.push({ recitalist_name, guest_count: Number(guest_count) })
    }
  }
  return rows
}

async function handleCSVUpload(e) {
  error.value = ''
  message.value = ''
  const file = e.target.files[0]
  if (!file) return
  const text = await file.text()
  const rows = parseCSV(text)
  if (!rows.length) {
    showToast('CSV is empty or invalid.', false)
    return
  }
  if (!activeEvent.value) {
    showToast('No active event set.', false)
    return
  }
  // Insert all tickets in batch
  let allTickets = []
  for (const row of rows) {
    // Recitalist ticket
    let manualCode = generateManualCode();
    let exists = true;
    while (exists) {
      const { data: existing } = await supabase.from('tickets').select('id').eq('manual_code', manualCode).maybeSingle();
      if (!existing) exists = false;
      else manualCode = generateManualCode();
    }
    allTickets.push({
      event_id: activeEvent.value.id,
      ticket_type: recitalistType,
      name: row.recitalist_name,
      created_by_name: row.recitalist_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      manual_code: manualCode
    })
    // Guest tickets
    for (let i = 0; i < row.guest_count; i++) {
      let guestCode = generateManualCode();
      let guestExists = true;
      while (guestExists) {
        const { data: existing } = await supabase.from('tickets').select('id').eq('manual_code', guestCode).maybeSingle();
        if (!existing) guestExists = false;
        else guestCode = generateManualCode();
      }
      allTickets.push({
        event_id: activeEvent.value.id,
        ticket_type: guestType,
        name: null,
        created_by_name: row.recitalist_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        manual_code: guestCode
      })
    }
  }
  const { error: err } = await supabase.from('tickets').insert(allTickets)
  if (err) {
    showToast(err.message, false)
    return
  }
  showToast(`Batch upload successful! ${rows.length} recitalists added.`, true)
  closeModal()
  await fetchTickets()
}

// QR Preview
const previewTicketGroup = (recitalistName) => {
  const group = groupedTickets.value.find(g => g.recitalist.name === recitalistName)
  if (!group) return
  selectedPerformerName.value = recitalistName
  previewTickets.value = [group.recitalist, ...group.guests]
  previewMode.value = 'batch'
  showPreviewModal.value = true
}

const previewSingleTicket = (ticket) => {
  singlePreviewTicket.value = ticket
  previewMode.value = 'single'
  showPreviewModal.value = true
}


// Ticket card references
const cardRefs = ref({})

function setCardRef(id) {
  return el => {
    if (!cardRefs.value) cardRefs.value = {}
    if (el) {
      cardRefs.value[id] = el
    } else {
      delete cardRefs.value[id]
    }
  }
}


const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 6

const filteredGroupedTickets = computed(() => {
  if (!searchQuery.value) return groupedTickets.value
  return groupedTickets.value.filter(group =>
    group.recitalist.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const totalPages = computed(() =>
  Math.ceil(filteredGroupedTickets.value.length / itemsPerPage)
)

const paginatedGroupedTickets = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredGroupedTickets.value.slice(start, start + itemsPerPage)
})

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

watch(searchQuery, () => {
  currentPage.value = 1
})

onMounted(async () => {
  await fetchActiveEvent()
  await fetchTickets()
})

// Batch PDF
async function saveTicketsAsPDF() {
  // Hide actions on all cards before export
  for (const ticket of previewTickets.value) {
    const cardComp = cardRefs.value[ticket.id]
    if (cardComp) cardComp.removeActions()
  }
  await nextTick()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'px' })
  for (let i = 0; i < previewTickets.value.length; i++) {
    const ticket = previewTickets.value[i]
    const cardComp = cardRefs.value[ticket.id]
    if (!cardComp) continue

    await cardComp.prepareForExport()
    await nextTick()
    const cardEl = cardComp.cardRef
    const canvas = await html2canvas(cardEl, { backgroundColor: null, willReadFrequently: true })
    cardComp.restoreAfterExport()

    const imgData = canvas.toDataURL('image/png')
    if (i > 0) doc.addPage()
    doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
  }

  // Restore actions on all cards after export
  for (const ticket of previewTickets.value) {
    const cardComp = cardRefs.value[ticket.id]
    if (cardComp) cardComp.restoreActions()
  }

  doc.save('tickets.pdf')
}

// Handler for "Download All as PDF" button:
function downloadBatchPDF() {
  exportTicketsAsPDF(previewTickets.value)
}

// Handler for "Download All as ZIP" button:
function downloadBatchZip() {
  downloadBatchZipImpl();
}

// Batch ZIP
async function downloadBatchZipImpl() {
  const zip = new JSZip()
  for (const ticket of previewTickets.value) {
    const cardComp = cardRefs.value[ticket.id]
    if (!cardComp) continue

    await cardComp.prepareForExport()
    await nextTick()
    const cardEl = cardComp.cardRef
    const canvas = await html2canvas(cardEl, { backgroundColor: null, willReadFrequently: true })
    cardComp.restoreAfterExport()

    const imgData = canvas.toDataURL('image/png')
    const base64 = imgData.split(',')[1]
    zip.file(`ticket-${ticket.id}.png`, base64, { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'tickets.zip'
  link.click()
}

// PDF Export
async function exportTicketsAsPDF(tickets) {
  const cardsPerRow = 2
  const cardsPerCol = 2
  const cardsPerPage = cardsPerRow * cardsPerCol
  const pageWidth = 794
  const pageHeight = 1123
  const cardWidth = 340
  const cardHeight = 440
  const marginX = (pageWidth - cardsPerRow * cardWidth) / (cardsPerRow + 1)
  const marginY = (pageHeight - cardsPerCol * cardHeight) / (cardsPerCol + 1)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight]
  })

  let cardIndex = 0
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]
    const cardComp = cardRefs.value[ticket.id]
    if (!cardComp) continue

    await cardComp.prepareForExport()
    await nextTick()
    const cardEl = cardComp.cardRef
    const canvas = await html2canvas(cardEl, { backgroundColor: null, willReadFrequently: true })
    cardComp.restoreAfterExport()

    const row = Math.floor(cardIndex / cardsPerRow) % cardsPerCol
    const col = cardIndex % cardsPerRow
    const x = marginX + col * (cardWidth + marginX)
    const y = marginY + row * (cardHeight + marginY)

    if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
      doc.addPage([pageWidth, pageHeight], 'px')
    }

    doc.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      x,
      y,
      cardWidth,
      cardHeight
    )

    cardIndex++
  }

  doc.save('tickets.pdf')
}

const totalTicketLimit = ref(100) // Set this to your actual ticket limit

const ticketsLeft = computed(() => {
  if (!activeEvent.value) return 0
  return (activeEvent.value.max_tickets || 0) - tickets.value.length
})

const showClaimerPrompt = ref(false)
const claimerName = ref('')
const ticketsToClaim = ref([])
const claimMode = ref('single') // or 'batch'

function cancelClaim() {
  showClaimerPrompt.value = false
  claimerName.value = ''
  ticketsToClaim.value = []
}

async function confirmClaim() {
  const now = new Date().toISOString()
  const unclaimedIds = ticketsToClaim.value
    .filter(t => t.status === 'unclaimed')
    .map(t => t.id)
  if (unclaimedIds.length === 0) {
    showClaimerPrompt.value = false
    claimerName.value = ''
    return
  }
  await supabase
    .from('tickets')
    .update({
      claimed_by: claimerName.value,
      claimed_at: now,
      status: 'claimed'
    })
    .in('id', unclaimedIds)
  for (const id of unclaimedIds) {
    await supabase.from('ticket_logs').insert({
      ticket_id: id,
      action: 'claimed',
      notes: `Ticket claimed by ${claimerName.value}`
    })
  }
  await fetchTickets()
  showClaimerPrompt.value = false
  claimerName.value = ''
  if (batchDownloadType.value === 'pdf') downloadBatchPDF()
  else if (batchDownloadType.value === 'zip') downloadBatchZip()
}

const batchDownloadType = ref('pdf') // or 'zip'

async function handleBatchDownload(type = 'pdf') {
  batchDownloadType.value = type
  const unclaimed = previewTickets.value.filter(t => !t.claimed_by)
  if (unclaimed.length > 0) {
    ticketsToClaim.value = unclaimed
    claimMode.value = 'batch'
    showClaimerPrompt.value = true
  } else {
    if (type === 'pdf') downloadBatchPDF()
    else if (type === 'zip') downloadBatchZip()
  }
}

const toast = ref({ show: false, message: '', success: true })
function showToast(message, success = true) {
  toast.value = { show: true, message, success }
  setTimeout(() => { toast.value.show = false }, 2500)
}

function showMessage(msg, type = 'success') {
  toast(msg, { type })
}
</script>

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-base font-semibold transition-all', toast.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white']" style="transform: translateX(-50%); min-width: 220px;">
      {{ toast.message }}
    </div>
    <div class="max-w-5xl mx-auto">
      <!-- Add Recitalist & Batch Upload Buttons -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
        <div class="flex gap-2">
          <button
            @click="openAddModal"
            :disabled="!activeEvent"
            class="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
          >
            + Add Recitalist
          </button>
          <button
            @click="openBatchModal"
            :disabled="!activeEvent"
            class="inline-flex items-center px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50"
          >
            Batch Upload CSV
          </button>
        </div>
        <!-- Search Bar -->
        <div class="flex items-center gap-2 mt-2 sm:mt-0">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search recitalist..."
            class="px-3 py-2 rounded-lg border border-gray-600 bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30"
          />
        </div>
      </div>

      <!-- Active Event Banner -->
      <div v-if="activeEvent" class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-blue-900/80 to-blue-700/60 border border-blue-500 rounded-2xl shadow-lg p-6 mb-2">
          <div>
            <span class="text-white font-bold text-lg">Active Event:</span>
            <span class="text-blue-300 font-extrabold text-xl ml-2">{{ activeEvent.event_name }}</span>
            <span class="text-gray-300 ml-3 text-base">{{ formatDate(activeEvent.event_date) }}</span>
          </div>
          <div class="text-base text-blue-200 font-medium mt-2 sm:mt-0">Venue: {{ activeEvent.venue_name }}</div>
        </div>
        <div class="flex flex-wrap items-center gap-4 mt-4">
          <div class="flex items-center bg-[#181f2a] border border-green-700 rounded-lg px-4 py-2 shadow">
            <span class="text-green-400 font-bold text-base mr-2">Tickets Left</span>
            <span class="text-green-200 font-mono text-xl">{{ ticketsLeft }}</span>
            <span v-if="activeEvent" class="ml-2 text-gray-400 text-base">/ {{ activeEvent.max_tickets }}</span>
          </div>
        </div>
      </div>
      <div v-else class="mb-8 text-center text-red-400 font-semibold">
        No active event set. Please set an active event first.
      </div>

      <!-- Recitalists & Guests List with Pagination -->
      <div>
        <h2 class="text-2xl font-bold text-white mb-6">Recitalists & Guests</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            v-for="group in paginatedGroupedTickets"
            :key="group.recitalist.id"
            class="bg-[#232b3b] rounded-2xl shadow-lg border border-blue-900/40 p-6 flex flex-col gap-3 hover:border-blue-400 transition relative"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <div class="text-xl font-bold text-blue-300 flex items-center gap-2">
                  <span class="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
                  {{ group.recitalist.name }}
                </div>
                <div class="text-xs text-gray-400 mt-1">Recitalist Ticket ID: <span class="font-mono">{{ group.recitalist.id }}</span></div>
              </div>
              <div class="flex flex-col items-end gap-2">
                <span :class="{
                  'bg-gray-500': group.recitalist.status === 'unclaimed',
                  'bg-yellow-500': group.recitalist.status === 'claimed',
                  'bg-green-600': group.recitalist.status === 'scanned'
                }" class="px-3 py-1 text-white text-xs font-semibold rounded shadow">
                  {{ group.recitalist.status }}
                </span>
                <div class="flex gap-1 mt-2">
                  <button
                    @click="previewTicketGroup(group.recitalist.name)"
                    class="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition shadow"
                  >
                    Batch Preview
                  </button>
                  <button
                    @click="previewSingleTicket(group.recitalist)"
                    class="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition shadow"
                  >
                    QR Preview
                  </button>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <div class="text-xs text-gray-500">
                <span>Claimed: {{ group.recitalist.claimed_at ? formatDate(group.recitalist.claimed_at) : '—' }}</span>
                <span class="ml-2">Scanned: {{ group.recitalist.scanned_at ? formatDate(group.recitalist.scanned_at) : '—' }}</span>
              </div>
              <div v-if="group.guests.length" class="mt-3">
                <div class="text-sm text-blue-200 font-semibold mb-1">Guest Tickets:</div>
                <ul class="flex flex-col gap-1">
                  <li v-for="guest in group.guests" :key="guest.id" class="flex items-center gap-2">
                    <span class="font-mono text-xs text-gray-400">{{ guest.id }}</span>
                    <span :class="{
                      'bg-gray-500': guest.status === 'unclaimed',
                      'bg-yellow-500': guest.status === 'claimed',
                      'bg-green-600': guest.status === 'scanned'
                    }" class="px-2 py-0.5 text-white text-xs font-semibold rounded shadow">
                      {{ guest.status }}
                    </span>
                    <button
                      @click="previewSingleTicket(guest)"
                      class="px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                    >
                      QR Preview
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div v-if="paginatedGroupedTickets.length === 0" class="col-span-full text-center text-gray-500 py-8">
            No recitalists found for this event.
          </div>
        </div>
        <!-- Pagination Controls -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-8">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
          >Previous</button>
          <span class="text-white text-sm">Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
          >Next</button>
        </div>
      </div>
    </div>

    <!-- Modal for Add Recitalist or Batch Upload -->
    <transition name="fade">
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#232b3b] rounded-xl max-w-md w-full shadow-2xl border border-blue-700 relative" @click.stop>
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 class="text-lg font-semibold text-white">
              {{ isBatch ? 'Batch Upload Recitalists (CSV)' : 'Add Recitalist' }}
            </h3>
            <button @click="closeModal" class="text-gray-400 hover:text-red-400 transition-colors duration-200">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          <!-- Modal Body -->
          <form v-if="!isBatch" @submit.prevent="addRecitalist" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Recitalist Name</label>
              <input v-model="form.recitalist_name" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Number of Guests</label>
              <input v-model.number="form.guest_count" type="number" min="0" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="closeModal"
                class="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
              >Cancel</button>
              <button
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >Add</button>
            </div>
          </form>
          <form v-else class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">CSV File</label>
              <input type="file" accept=".csv" @change="handleCSVUpload" class="w-full text-white" />
              <p class="text-xs text-gray-400 mt-2">Format: <code>recitalist_name,guest_count</code> (one per line)</p>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="closeModal"
                class="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
              >Close</button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <!-- Preview Modal (Batch or Single) -->
    <div v-if="showPreviewModal" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <!-- Overlay -->
      <div
        class="absolute inset-0 bg-black bg-opacity-60"
        @click="closePreviewModal"
      ></div>
      <!-- Modal content -->
      <div
        class="relative z-10 bg-[#232b3b] rounded-lg max-w-4xl w-full max-h-full overflow-auto border border-blue-700 shadow-2xl"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between p-6 border-b border-blue-700">
          <h3 class="text-lg font-semibold text-white">
            <template v-if="previewMode === 'batch'">
              Ticket Preview - {{ selectedPerformerName }}
            </template>
            <template v-else>
              Ticket Preview - {{ singlePreviewTicket?.name || singlePreviewTicket?.created_by_name || 'Guest' }}
            </template>
          </h3>
          <button @click="closePreviewModal" class="text-gray-400 hover:text-red-400 transition-colors duration-200">
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>
        <!-- Modal Body -->
        <div class="p-6 max-h-96 overflow-y-auto">
          <div v-if="previewMode === 'batch'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
            <div class="flex justify-center items-center" v-for="ticket in previewTickets" :key="ticket.id">
              <QRTicketCard
                :ref="setCardRef(ticket.id)"
                :ticket="ticket"
                :color="ticket.ticket_type === 'recitalist' ? 'blue' : 'green'"
              />
            </div>
          </div>
          <div v-else-if="previewMode === 'single'" class="flex justify-center">
            <QRTicketCard
              v-if="singlePreviewTicket"
              :ref="setCardRef(singlePreviewTicket.id)"
              :ticket="singlePreviewTicket"
              :color="singlePreviewTicket.ticket_type === 'recitalist' ? 'blue' : 'green'"
            />
          </div>
        </div>
        <!-- Modal Footer -->
        <div class="flex gap-3 p-6 border-t border-blue-700 justify-end">
          <template v-if="previewMode === 'batch'">
            <button 
              @click="handleBatchDownload('pdf')"
              class="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <DocumentArrowDownIcon class="w-4 h-4 mr-2" />
              Download All as PDF
            </button>
            <button 
              @click="handleBatchDownload('zip')"
              class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <DocumentArrowDownIcon class="w-4 h-4 mr-2" />
              Download All as ZIP
            </button>
          </template>
          <template v-else>
          </template>
        </div>
      </div>
    </div>

    <!-- Claimer Prompt Modal -->
    <div v-if="showClaimerPrompt" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div class="bg-[#232b3b] rounded-xl max-w-md w-full shadow-2xl border border-blue-700 relative" @click.stop>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Claim Tickets</h3>
          <label class="block text-sm font-medium text-gray-300 mb-1">Claimer Name</label>
          <input v-model="claimerName" class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white mb-4" />
          <div class="flex justify-end gap-2">
            <button @click="cancelClaim" class="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition">Cancel</button>
            <button @click="confirmClaim" :disabled="!claimerName.trim()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Confirm</button>
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
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>