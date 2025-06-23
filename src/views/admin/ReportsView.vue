<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../composables/useTheme'

const { themeClasses } = useTheme()

const pastEvents = ref([])
const loading = ref(true)
const error = ref('')
const selectedEvent = ref(null)
const eventTickets = ref([])
const showReportModal = ref(false)

// Fetch all finished events
async function fetchPastEvents() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_finished', true)
    .order('event_date', { ascending: false })
  if (err) error.value = err.message
  else pastEvents.value = data
  loading.value = false
}

// Fetch tickets for a specific event
async function fetchEventTickets(eventId) {
  eventTickets.value = []
  const { data, error: err } = await supabase
    .from('tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (!err) eventTickets.value = data
}

function openReport(event) {
  selectedEvent.value = event
  fetchEventTickets(event.id)
  showReportModal.value = true
}

function closeReport() {
  showReportModal.value = false
  selectedEvent.value = null
  eventTickets.value = []
}

const groupedTickets = computed(() => {
  if (!eventTickets.value.length) return []
  const groups = {}
  eventTickets.value.forEach(ticket => {
    if (ticket.ticket_type === 'recitalist') {
      groups[ticket.name] = { recitalist: ticket, guests: [] }
    }
  })
  eventTickets.value.forEach(ticket => {
    if (ticket.ticket_type === 'guest' && groups[ticket.created_by_name]) {
      groups[ticket.created_by_name].guests.push(ticket)
    }
  })
  return Object.values(groups)
})

const ticketStats = computed(() => {
  if (!eventTickets.value.length || !selectedEvent.value) return null
  
  const stats = {
    totalTickets: selectedEvent.value.max_tickets || 0,
    usedTickets: eventTickets.value.length,
    unusedTickets: 0,
    unclaimed: 0,
    claimed: 0,
    scanned: 0,
    byType: {
      recitalist: { total: 0, unclaimed: 0, claimed: 0, scanned: 0 },
      guest: { total: 0, unclaimed: 0, claimed: 0, scanned: 0 }
    }
  }
  
  stats.unusedTickets = stats.totalTickets - stats.usedTickets
  
  eventTickets.value.forEach(ticket => {
    // Overall stats
    if (ticket.status === 'unclaimed') stats.unclaimed++
    else if (ticket.status === 'claimed') stats.claimed++
    else if (ticket.status === 'scanned') stats.scanned++
    
    // By type stats
    const type = ticket.ticket_type
    if (stats.byType[type]) {
      stats.byType[type].total++
      if (ticket.status === 'unclaimed') stats.byType[type].unclaimed++
      else if (ticket.status === 'claimed') stats.byType[type].claimed++
      else if (ticket.status === 'scanned') stats.byType[type].scanned++
    }
  })
  
  return stats
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function printReport() {
  // Create a simple print window with just the report content
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${selectedEvent.value?.event_name} - Event Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: black; background: white; line-height: 1.4; }
        h1 { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; font-size: 18px; }
        .event-details { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #ccc; padding-bottom: 15px; font-size: 12px; }
        .event-details div { margin-bottom: 4px; }
        .stats-section { margin-bottom: 25px; }
        .stats-section h3 { font-size: 14px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        
        /* Clean statistics grid */
        .stats-grid { display: table; width: 100%; margin-bottom: 15px; }
        .stats-row { display: table-row; }
        .stats-cell { display: table-cell; border: 1px solid black; padding: 8px; text-align: center; font-size: 11px; }
        .stats-cell .label { font-weight: bold; margin-bottom: 3px; }
        .stats-cell .value { font-size: 14px; font-weight: bold; }
        
        /* Summary boxes */
        .summary-row { margin-bottom: 10px; }
        .summary-box { display: inline-block; border: 1px solid black; padding: 6px 10px; margin-right: 10px; font-size: 11px; text-align: center; min-width: 80px; }
        .summary-box .label { font-weight: bold; display: block; margin-bottom: 2px; }
        .summary-box .value { font-weight: bold; font-size: 13px; }
        
        /* Type breakdown */
        .type-breakdown { margin-top: 15px; }
        .type-box { border: 1px solid black; padding: 8px; margin-bottom: 8px; font-size: 10px; }
        .type-box .title { font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        .type-box .stats { line-height: 1.3; }
        
        /* Table styling */
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
        th, td { border: 1px solid black; padding: 8px; text-align: left; vertical-align: top; }
        th { font-weight: bold; background: #f5f5f5; text-align: center; }
        .recitalist-name { font-weight: bold; }
        .guest-list { line-height: 1.4; }
        .guest-item { margin-bottom: 3px; display: block; }
        .status { 
          border: 1px solid black; 
          padding: 2px 4px; 
          font-size: 8px; 
          font-weight: bold; 
          text-transform: uppercase; 
          margin-left: 8px;
          display: inline-block;
          min-width: 60px;
          text-align: center;
        }
        .no-guests { font-style: italic; color: #666; }
        
        @page { margin: 0.75in; size: letter; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${selectedEvent.value?.event_name} - Event Report</h1>
      
      <div class="event-details">
        <div><strong>Date:</strong> ${formatDate(selectedEvent.value?.event_date)}</div>
        <div><strong>Venue:</strong> ${selectedEvent.value?.venue_name}</div>
        <div><strong>Max Tickets:</strong> ${selectedEvent.value?.max_tickets}</div>
      </div>
      
      ${ticketStats.value ? `
        <div class="stats-section">
          <h3>Ticket Statistics</h3>
          
          <!-- Main Statistics Grid -->
          <div class="stats-grid">
            <div class="stats-row">
              <div class="stats-cell">
                <div class="label">Total Capacity</div>
                <div class="value">${ticketStats.value.totalTickets}</div>
              </div>
              <div class="stats-cell">
                <div class="label">Used Tickets</div>
                <div class="value">${ticketStats.value.usedTickets}</div>
              </div>
              <div class="stats-cell">
                <div class="label">Unused Tickets</div>
                <div class="value">${ticketStats.value.unusedTickets}</div>
              </div>
              <div class="stats-cell">
                <div class="label">Attendance Rate</div>
                <div class="value">${Math.round((ticketStats.value.scanned / ticketStats.value.usedTickets) * 100) || 0}%</div>
              </div>
            </div>
          </div>
          
          <!-- Status Summary -->
          <div class="summary-row">
            <div class="summary-box">
              <span class="label">Unclaimed</span>
              <span class="value">${ticketStats.value.unclaimed}</span>
            </div>
            <div class="summary-box">
              <span class="label">Claimed</span>
              <span class="value">${ticketStats.value.claimed}</span>
            </div>
            <div class="summary-box">
              <span class="label">Scanned</span>
              <span class="value">${ticketStats.value.scanned}</span>
            </div>
          </div>
          
          <!-- Type Breakdown -->
          <div class="type-breakdown">
            <div class="type-box">
              <div class="title">Recitalist Tickets</div>
              <div class="stats">Total: ${ticketStats.value.byType.recitalist.total} | Unclaimed: ${ticketStats.value.byType.recitalist.unclaimed} | Claimed: ${ticketStats.value.byType.recitalist.claimed} | Scanned: ${ticketStats.value.byType.recitalist.scanned}</div>
            </div>
            <div class="type-box">
              <div class="title">Guest Tickets</div>
              <div class="stats">Total: ${ticketStats.value.byType.guest.total} | Unclaimed: ${ticketStats.value.byType.guest.unclaimed} | Claimed: ${ticketStats.value.byType.guest.claimed} | Scanned: ${ticketStats.value.byType.guest.scanned}</div>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="stats-section">
        <h3>Recitalists & Guests</h3>
        ${groupedTickets.value.length === 0 ? '<p>No tickets found for this event.</p>' : `
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Recitalist</th>
                <th style="width: 70%;">Guest(s)</th>
              </tr>
            </thead>
            <tbody>
              ${groupedTickets.value.map(group => `
                <tr>
                  <td>
                    <span class="recitalist-name">${group.recitalist.name}</span>
                    <span class="status">${group.recitalist.status.toUpperCase()}</span>
                  </td>
                  <td>
                    ${group.guests.length > 0 ? 
                      `<div class="guest-list">${group.guests.map(guest => 
                        `<span class="guest-item">Guest Ticket (${guest.manual_code || guest.id.slice(0, 8)})<span class="status">${guest.status.toUpperCase()}</span></span>`
                      ).join('')}</div>` 
                      : '<span class="no-guests">No guests</span>'
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </body>
    </html>
  `
  
  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}

onMounted(fetchPastEvents)
</script>

<template>  <div :class="[themeClasses.pageBackground, 'min-h-screen py-8 px-4']">
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 :class="[themeClasses.textPrimary, 'text-3xl font-bold flex items-center']">
            <svg class="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Event Reports
          </h1>
          <p :class="[themeClasses.textMuted, 'mt-2 text-lg']">View detailed reports for completed events</p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-16">
        <div :class="['inline-block w-8 h-8 border-4 border-current border-r-transparent rounded-full animate-spin', themeClasses.textMuted]"></div>
        <p :class="['mt-4 text-lg font-medium', themeClasses.textMuted]">Loading reports...</p>
      </div>

      <!-- Content -->
      <div v-else-if="pastEvents.length === 0" class="text-center py-16">
        <svg :class="['w-16 h-16 mx-auto mb-6 opacity-50', themeClasses.textMuted]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 :class="[themeClasses.textPrimary, 'text-2xl font-semibold mb-3']">No Completed Events</h2>
        <p :class="[themeClasses.textMuted, 'max-w-md mx-auto leading-relaxed']">
          Reports will appear here once events are completed and finished.
        </p>
      </div>

      <!-- Events Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="event in pastEvents"
          :key="event.id"
          :class="[
            'group rounded-xl shadow-lg border p-6 space-y-4 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1 cursor-pointer',
            themeClasses.card,
            themeClasses.cardBorder
          ]"
          @click="openReport(event)"
        >
          <!-- Event Header -->
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 :class="['text-lg font-bold line-clamp-2', themeClasses.textPrimary]">
                {{ event.event_name }}
              </h3>
              <p :class="['text-sm mt-1', themeClasses.textMuted]">
                {{ formatDate(event.event_date) }}
              </p>
            </div>
            <div :class="[
              'p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
              themeClasses.hover
            ]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>

          <!-- Event Details -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span :class="['text-sm font-medium', themeClasses.textSecondary]">Venue:</span>
              <span :class="['text-sm', themeClasses.textPrimary]">{{ event.venue_name || '—' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span :class="['text-sm font-medium', themeClasses.textSecondary]">Total Tickets:</span>
              <span :class="['text-sm font-semibold', themeClasses.textPrimary]">{{ event.max_tickets || 'N/A' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span :class="['text-sm font-medium', themeClasses.textSecondary]">Event Date:</span>
              <span :class="['text-sm', themeClasses.textPrimary]">{{ formatDate(event.event_date) }}</span>
            </div>
          </div>

          <!-- Action Button -->
          <div class="pt-4 border-t" :class="themeClasses.cardBorder">
            <button
              :class="[
                'w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors',
                themeClasses.buttonPrimary
              ]"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Report
            </button>
          </div>
        </div>
      </div>
    </div>    <!-- Report Modal -->
    <div v-if="showReportModal" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div :class="['absolute inset-0 print:hidden', themeClasses.overlay]" @click="closeReport"></div>
      <div :class="[
        'relative z-10 rounded-lg max-w-4xl w-full max-h-full overflow-auto shadow-2xl p-8 print-content',
        themeClasses.modal,
        themeClasses.cardBorder
      ]">
        <!-- Modal Header -->
        <div class="flex items-center justify-between mb-6 print:mb-8">
          <h2 :class="[themeClasses.textPrimary, 'text-2xl font-bold']">
            {{ selectedEvent?.event_name }} - Event Report
          </h2>
          <button 
            @click="closeReport" 
            :class="[themeClasses.textMuted, 'hover:text-red-500 transition-colors duration-200 print:hidden']"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="mb-4">
          <div class="text-base text-gray-200"><span class="font-semibold">Date:</span> {{ formatDate(selectedEvent?.event_date) }}</div>
          <div class="text-base text-gray-200"><span class="font-semibold">Venue:</span> {{ selectedEvent?.venue_name }}</div>
          <div class="text-base text-gray-200"><span class="font-semibold">Max Tickets:</span> {{ selectedEvent?.max_tickets }}</div>
        </div>
        
        <!-- Ticket Statistics -->
        <div v-if="ticketStats" class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-3">Ticket Statistics</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div class="bg-blue-900 p-3 rounded">
              <div class="text-xs text-blue-300">Total Capacity</div>
              <div class="text-xl font-bold text-white">{{ ticketStats.totalTickets }}</div>
            </div>
            <div class="bg-green-900 p-3 rounded">
              <div class="text-xs text-green-300">Used Tickets</div>
              <div class="text-xl font-bold text-white">{{ ticketStats.usedTickets }}</div>
            </div>
            <div class="bg-gray-900 p-3 rounded">
              <div class="text-xs text-gray-300">Unused Tickets</div>
              <div class="text-xl font-bold text-white">{{ ticketStats.unusedTickets }}</div>
            </div>
            <div class="bg-purple-900 p-3 rounded">
              <div class="text-xs text-purple-300">Attendance Rate</div>
              <div class="text-xl font-bold text-white">{{ Math.round((ticketStats.scanned / ticketStats.usedTickets) * 100) || 0 }}%</div>
            </div>
          </div>
          
          <!-- Status Breakdown -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-gray-800 p-3 rounded">
              <div class="text-xs text-gray-400">Unclaimed</div>
              <div class="text-lg font-bold text-white">{{ ticketStats.unclaimed }}</div>
            </div>
            <div class="bg-yellow-800 p-3 rounded">
              <div class="text-xs text-yellow-300">Claimed</div>
              <div class="text-lg font-bold text-white">{{ ticketStats.claimed }}</div>
            </div>
            <div class="bg-green-800 p-3 rounded">
              <div class="text-xs text-green-300">Scanned</div>
              <div class="text-lg font-bold text-white">{{ ticketStats.scanned }}</div>
            </div>
          </div>
          
          <!-- By Type Breakdown -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-blue-800 p-3 rounded">
              <div class="text-sm font-semibold text-blue-200 mb-2">Recitalist Tickets</div>
              <div class="text-xs text-blue-300">Total: {{ ticketStats.byType.recitalist.total }} | Unclaimed: {{ ticketStats.byType.recitalist.unclaimed }} | Claimed: {{ ticketStats.byType.recitalist.claimed }} | Scanned: {{ ticketStats.byType.recitalist.scanned }}</div>
            </div>
            <div class="bg-green-800 p-3 rounded">
              <div class="text-sm font-semibold text-green-200 mb-2">Guest Tickets</div>
              <div class="text-xs text-green-300">Total: {{ ticketStats.byType.guest.total }} | Unclaimed: {{ ticketStats.byType.guest.unclaimed }} | Claimed: {{ ticketStats.byType.guest.claimed }} | Scanned: {{ ticketStats.byType.guest.scanned }}</div>
            </div>
          </div>
        </div>
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-2">Recitalists & Guests</h3>
          <div v-if="groupedTickets.length === 0" class="text-gray-400">No tickets found for this event.</div>
          <div v-else>            <table class="w-full text-left border-collapse mb-4">
              <thead>
                <tr class="bg-blue-900 text-white">
                  <th class="py-2 px-3 rounded-tl-lg">Recitalist</th>
                  <th class="py-2 px-3 rounded-tr-lg">Guest(s)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="group in groupedTickets" :key="group.recitalist.id" class="bg-[#181f2a] text-white border-b border-blue-800">
                  <td class="py-2 px-3 font-semibold">
                    <div class="flex justify-between items-center">
                      <span>{{ group.recitalist.name }}</span>
                      <span :class="{
                        'bg-green-600 text-white px-2 py-1 rounded text-xs ml-2': group.recitalist.status === 'scanned',
                        'bg-yellow-600 text-white px-2 py-1 rounded text-xs ml-2': group.recitalist.status === 'claimed',
                        'bg-gray-600 text-white px-2 py-1 rounded text-xs ml-2': group.recitalist.status === 'unclaimed',
                      }">
                        {{ group.recitalist.status }}
                      </span>
                    </div>
                  </td>
                  <td class="py-2 px-3">
                    <ul v-if="group.guests.length > 0">
                      <li v-for="guest in group.guests" :key="guest.id" class="flex justify-between items-center">
                        <span>Guest Ticket ({{ guest.manual_code || guest.id.slice(0, 8) }})</span>
                        <span :class="{
                          'bg-green-600 text-white px-1 py-0.5 rounded text-xs ml-2': guest.status === 'scanned',
                          'bg-yellow-600 text-white px-1 py-0.5 rounded text-xs ml-2': guest.status === 'claimed',
                          'bg-gray-600 text-white px-1 py-0.5 rounded text-xs ml-2': guest.status === 'unclaimed',
                        }">
                          {{ guest.status }}
                        </span>
                      </li>
                    </ul>
                    <span v-else class="text-gray-500 italic">No guests</span>
                  </td>
                </tr>
              </tbody>            </table>
          </div>
        </div>
        
        <div class="flex justify-end gap-2 print:hidden">
          <button @click="printReport" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Print Report</button>
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

@media print {
  /* Hide the entire page */
  body > * {
    display: none !important;
  }
  
  /* Show only the print content */
  body .print-content {
    display: block !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color: black !important;
    font-family: Arial, sans-serif !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
  }
  
  /* Reset body */
  body {
    background: white !important;
    color: black !important;
    margin: 0 !important;
    padding: 0 !important;
  }  
  /* Report header - simple and clean */
  .print-content h2 {
    font-size: 16px !important;
    font-weight: bold !important;
    text-align: center !important;
    margin: 0 0 20px 0 !important;
    color: black !important;
    border-bottom: 2px solid black !important;
    padding-bottom: 8px !important;
  }
  
  .print-content h3 {
    font-size: 13px !important;
    font-weight: bold !important;
    margin: 15px 0 5px 0 !important;
    color: black !important;
  }
  
  /* Event details - simple centered text */
  .print-content .mb-4:first-of-type {
    text-align: center !important;
    margin-bottom: 20px !important;
    border-bottom: 1px solid #ccc !important;
    padding-bottom: 10px !important;
  }
  
  .print-content .mb-4 div {
    margin-bottom: 3px !important;
    font-size: 11px !important;
    color: black !important;
  }
  
  /* Hide all modal styling elements */
  .print-content .flex.items-center.justify-between {
    display: block !important;
  }
  
  .print-content button {
    display: none !important;
  }
  
  /* Statistics section - simple boxes */
  .print-content .mb-6 {
    margin-bottom: 15px !important;
  }
  
  .print-content .grid {
    display: block !important;
    margin-bottom: 10px !important;
  }
  
  .print-content .grid > div {
    display: inline-block !important;
    width: auto !important;
    margin: 0 15px 5px 0 !important;
    padding: 4px 8px !important;
    background: white !important;
    border: 1px solid black !important;
    border-radius: 0 !important;
    font-size: 10px !important;
    vertical-align: top !important;
  }
  
  .print-content .grid > div div:first-child {
    font-weight: bold !important;
    margin-bottom: 2px !important;
    color: black !important;
  }
  
  .print-content .grid > div div:last-child {
    font-size: 12px !important;
    font-weight: bold !important;
    color: black !important;
  }
  
  /* Table - clean and simple */
  .print-content table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 10px 0 !important;
    font-size: 10px !important;
  }
  
  .print-content th {
    background: white !important;
    color: black !important;
    border: 1px solid black !important;
    padding: 6px 4px !important;
    font-weight: bold !important;
    text-align: left !important;
  }
  
  .print-content td {
    background: white !important;
    color: black !important;
    border: 1px solid black !important;
    padding: 4px !important;
    vertical-align: top !important;
  }
  
  /* Remove all background colors and gradients */
  .print-content * {
    background: white !important;
    background-image: none !important;
    background-color: white !important;
    color: black !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  
  /* Status badges - simple bordered text */
  .print-content span[class*="bg-"] {
    background: white !important;
    color: black !important;
    border: 1px solid black !important;
    padding: 1px 3px !important;
    font-size: 8px !important;
    font-weight: bold !important;
    text-transform: uppercase !important;
    border-radius: 0 !important;
    margin-left: 5px !important;
  }
  
  /* Hide print button and close button */
  .print\:hidden {
    display: none !important;
  }
  
  /* Page settings */
  @page {
    margin: 0.75in !important;
    size: letter !important;
  }
  
  /* Prevent page breaks within content */
  .print-content {
    page-break-inside: avoid !important;
  }
  
  .print-content table {
    page-break-inside: auto !important;
  }
    .print-content tr {
    page-break-inside: avoid !important;
  }
}
</style>
