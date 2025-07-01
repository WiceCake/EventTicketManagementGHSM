<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../composables/useTheme'
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
const isSubmitting = ref(false) // For preventing double submissions
const isUploading = ref(false) // For CSV upload loading
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
    .eq('is_finished', false)
    .maybeSingle() // <-- Use maybeSingle instead of single

  if (err || !data) {
    error.value = 'No active, unfinished event set. Please set an active event first.'
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
  if (isSubmitting.value) return // Prevent double submission
  
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
  
  isSubmitting.value = true
  
  try {
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
  } catch (error) {
    showToast('Failed to add recitalist: ' + error.message, false)
  } finally {
    isSubmitting.value = false
  }
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
  if (isUploading.value) return // Prevent double upload
  
  error.value = ''
  message.value = ''
  const file = e.target.files[0]
  if (!file) return
  
  isUploading.value = true
  
  try {
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
  } catch (error) {
    showToast('Failed to upload CSV: ' + error.message, false)
  } finally {
    isUploading.value = false
    // Reset file input
    e.target.value = ''
  }
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

// Edit ticket functionality
const showEditModal = ref(false)
const editingGroup = ref(null)
const editForm = ref({
  recitalist_name: '',
  guest_tickets: []
})
const newGuestCount = ref(0)

// Delete confirmation modal
const showDeleteModal = ref(false)
const groupToDelete = ref(null)
const deleteConfirmText = ref('')

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

// Edit ticket functions
function openEditModal(group) {
  editingGroup.value = group
  editForm.value = {
    recitalist_name: group.recitalist.name,
    guest_tickets: [...group.guests] // Create a copy
  }
  newGuestCount.value = 0
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingGroup.value = null
  editForm.value = {
    recitalist_name: '',
    guest_tickets: []
  }
  newGuestCount.value = 0
}

async function deleteGuestTicket(guestTicket) {
  if (!confirm('Are you sure you want to delete this guest ticket?')) return
  
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', guestTicket.id)
  
  if (error) {
    showToast(error.message, false)
    return
  }
  
  // Remove from local form
  editForm.value.guest_tickets = editForm.value.guest_tickets.filter(t => t.id !== guestTicket.id)
  showToast('Guest ticket deleted successfully', true)
}

async function addGuestTickets() {
  if (newGuestCount.value <= 0) return
  
  const guestInserts = []
  for (let i = 0; i < newGuestCount.value; i++) {
    // Generate unique manual code for each guest
    let guestCode = generateManualCode()
    let guestExists = true
    while (guestExists) {
      const { data: existing } = await supabase.from('tickets').select('id').eq('manual_code', guestCode).maybeSingle()
      if (!existing) guestExists = false
      else guestCode = generateManualCode()
    }
    
    guestInserts.push({
      event_id: activeEvent.value.id,
      ticket_type: guestType,
      name: null,
      created_by_name: editForm.value.recitalist_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      manual_code: guestCode
    })
  }
  
  const { data: newGuests, error } = await supabase
    .from('tickets')
    .insert(guestInserts)
    .select()
  
  if (error) {
    showToast(error.message, false)
    return
  }
  
  // Add to local form
  editForm.value.guest_tickets.push(...newGuests)
  newGuestCount.value = 0
  showToast(`${newGuests.length} guest tickets added successfully`, true)
}

async function updateRecitalistName() {
  if (!editForm.value.recitalist_name.trim()) {
    showToast('Recitalist name cannot be empty', false)
    return
  }
  
  const { error } = await supabase
    .from('tickets')
    .update({
      name: editForm.value.recitalist_name,
      updated_at: new Date().toISOString()
    })
    .eq('id', editingGroup.value.recitalist.id)
  
  if (error) {
    showToast(error.message, false)
    return
  }
  
  // Also update all guest tickets' created_by_name
  const guestIds = editForm.value.guest_tickets.map(t => t.id)
  if (guestIds.length > 0) {
    await supabase
      .from('tickets')
      .update({
        created_by_name: editForm.value.recitalist_name,
        updated_at: new Date().toISOString()
      })
      .in('id', guestIds)
  }
  
  showToast('Recitalist name updated successfully', true)
}

async function saveChanges() {
  await updateRecitalistName()
  await fetchTickets() // Refresh the ticket list
  closeEditModal()
}

// Delete recitalist and all their guests
async function deleteRecitalistGroup(group) {
  groupToDelete.value = group
  showDeleteModal.value = true
}

async function confirmDeleteRecitalist() {
  if (!groupToDelete.value) return
  
  const group = groupToDelete.value
  const recitalistName = group.recitalist.name
  const totalTickets = 1 + group.guests.length
  
  try {
    // Get all ticket IDs (recitalist + guests)
    const allTicketIds = [group.recitalist.id, ...group.guests.map(g => g.id)]
    
    // First, delete all related ticket_logs to avoid foreign key constraint issues
    const { error: logsError } = await supabase
      .from('ticket_logs')
      .delete()
      .in('ticket_id', allTicketIds)
    
    if (logsError) {
      console.warn('Error deleting ticket logs:', logsError.message)
      // Continue anyway, as logs might not exist
    }
    
    // Then delete all tickets
    const { error: ticketsError } = await supabase
      .from('tickets')
      .delete()
      .in('id', allTicketIds)
    
    if (ticketsError) {
      showToast('Failed to delete tickets: ' + ticketsError.message, false)
      return
    }
    
    showToast(`Successfully deleted "${recitalistName}" and ${group.guests.length} guest tickets`, true)
    await fetchTickets() // Refresh the list
    closeDeleteModal()
    
  } catch (error) {
    showToast('Error deleting recitalist group: ' + error.message, false)
  }
}

function closeDeleteModal() {
  showDeleteModal.value = false
  groupToDelete.value = null
  deleteConfirmText.value = ''
}

function downloadCSVTemplate() {
  const csvContent = 'recitalist_name,guest_count\nJohn Doe,2\nJane Smith,1';
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'recitalists_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const { themeClasses } = useTheme()
</script>

<template>  <div :class="[themeClasses.pageBackground, 'min-h-screen py-8 px-4']">
    <!-- Toast Notification -->
    <div 
      v-if="toast.show" 
      :class="[
        'fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all transform -translate-x-1/2',
        toast.success ? themeClasses.toastSuccess : themeClasses.toastError
      ]"
    >
      {{ toast.message }}
    </div>
    
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- Header with controls -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 :class="[themeClasses.textPrimary, 'text-3xl font-bold tracking-tight']">Ticket Management</h1>
          <p :class="[themeClasses.textMuted, 'mt-2 text-lg']">Manage tickets for the current active event</p>
        </div>
        
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="openAddModal"
            :disabled="!activeEvent"
            :class="[
              'inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50',
              themeClasses.buttonPrimary
            ]"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Recitalist
          </button>
          <button
            @click="openBatchModal"
            :disabled="!activeEvent"
            :class="[
              'inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50',
              themeClasses.buttonSecondary
            ]"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Batch Upload CSV
          </button>
        </div>
      </div>

      <!-- Active Event Info -->
      <div v-if="activeEvent" :class="[themeClasses.card, themeClasses.cardBorder, 'p-6 rounded-xl border shadow-lg']">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 :class="[themeClasses.textPrimary, 'text-xl font-semibold']">{{ activeEvent.event_name }}</h2>
            <p :class="[themeClasses.textMuted, 'mt-1']">{{ formatDate(activeEvent.event_date) }} • {{ activeEvent.venue_name }}</p>
          </div>
          <div v-if="activeEvent" class="mt-4 lg:mt-0 flex items-center gap-4">
            <div :class="[themeClasses.badgeSuccess, 'px-3 py-1 rounded-full text-sm font-medium']">
              {{ ticketsLeft }} tickets available
            </div>
            <div :class="[themeClasses.textMuted, 'text-sm']">
              {{ tickets.length }} / {{ activeEvent.max_tickets }} used
            </div>
          </div>
        </div>
      </div>

      <!-- No Active Event -->
      <div v-else :class="[themeClasses.card, themeClasses.cardBorder, 'p-6 rounded-xl border shadow-lg text-center']">
        <svg :class="[themeClasses.textMuted, 'w-12 h-12 mx-auto mb-3 opacity-50']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 :class="[themeClasses.textPrimary, 'text-lg font-semibold mb-2']">No Active Event</h3>
        <p :class="[themeClasses.textMuted, 'text-sm']">Please set an event as active before managing tickets.</p>
      </div>

      <!-- Search Bar -->
      <div v-if="activeEvent" class="flex justify-between items-center">
        <h2 :class="[themeClasses.textPrimary, 'text-2xl font-semibold']">All Tickets</h2>
        <div class="flex items-center gap-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search recitalist..."
            :class="[
              themeClasses.input, 
              'px-4 py-2 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
            ]"
          />
        </div>
      </div>
      <div v-else :class="[themeClasses.text, 'mb-8 text-center font-semibold text-red-400']">
        No active event set. Please set an active event first.
      </div>

      <!-- Recitalists & Guests List with Pagination -->
      <div>
        <h2 :class="[themeClasses.text, 'text-2xl font-bold mb-6']">Recitalists & Guests</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            v-for="group in paginatedGroupedTickets"
            :key="group.recitalist.id"
            :class="[themeClasses.card, themeClasses.hover, 'rounded-2xl shadow-lg border p-6 flex flex-col gap-3 transition relative']"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <div class="text-xl font-bold text-blue-300 flex items-center gap-2">
                  <span :class="['inline-block w-2 h-2 rounded-full', themeClasses.isDark ? 'bg-blue-400' : 'bg-blue-600']"></span>
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
                </span>                <div class="flex gap-1 mt-2">
                  <button
                    @click="previewTicketGroup(group.recitalist.name)"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded transition shadow',
                      themeClasses.buttonPrimary
                    ]"
                  >
                    Batch Preview
                  </button>
                  <button
                    @click="previewSingleTicket(group.recitalist)"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded transition shadow',
                      themeClasses.buttonSuccess
                    ]"
                  >
                    QR Preview
                  </button>
                  <button
                    @click="openEditModal(group)"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded transition shadow',
                      themeClasses.buttonSecondary
                    ]"
                  >
                    Edit
                  </button>
                  <button
                    @click="deleteRecitalistGroup(group)"
                    :class="[
                      'px-3 py-1 text-xs font-semibold rounded transition shadow',
                      'bg-red-500 hover:bg-red-600 text-white'
                    ]"
                  >
                    Delete
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
                    </span>                    <button
                      @click="previewSingleTicket(guest)"
                      :class="[
                        'px-2 py-0.5 text-xs rounded transition',
                        themeClasses.buttonSuccess
                      ]"
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
        </div>        <!-- Pagination Controls -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-8">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            :class="[
              'px-4 py-2 rounded-lg font-medium text-sm transition-all',
              currentPage === 1 ? themeClasses.paginationButtonDisabled : themeClasses.paginationButton
            ]"
          >Previous</button>
          <span :class="[themeClasses.textPrimary, 'text-sm font-medium']">Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            :class="[
              'px-4 py-2 rounded-lg font-medium text-sm transition-all',
              currentPage === totalPages ? themeClasses.paginationButtonDisabled : themeClasses.paginationButton
            ]"
          >Next</button>
        </div>
      </div>
    </div>    <!-- Modal for Add Recitalist or Batch Upload -->
    <transition name="fade">
      <div v-if="showModal" :class="['fixed inset-0 flex items-center justify-center z-50 p-4', themeClasses.overlay]">
        <div :class="[themeClasses.card, 'rounded-xl max-w-md w-full shadow-2xl border relative']" @click.stop>
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b', themeClasses.border]">
            <h3 :class="[themeClasses.text, 'text-lg font-semibold']">
              {{ isBatch ? 'Batch Upload Recitalists (CSV)' : 'Add Recitalist' }}
            </h3>
            <button @click="closeModal" :class="[themeClasses.muted, 'hover:text-red-400 transition-colors duration-200']">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          <!-- Modal Body -->
          <form v-if="!isBatch" @submit.prevent="addRecitalist" class="p-6 space-y-4">
            <div>
              <label :class="[themeClasses.muted, 'block text-sm font-medium mb-1']">Recitalist Name</label>
              <input v-model="form.recitalist_name" required :class="[themeClasses.input, 'w-full px-3 py-2 rounded']" />
            </div>
            <div>
              <label :class="[themeClasses.muted, 'block text-sm font-medium mb-1']">Number of Guests</label>
              <input v-model.number="form.guest_count" type="number" min="0" required :class="[themeClasses.input, 'w-full px-3 py-2 rounded']" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="closeModal"
                :disabled="isSubmitting"
                :class="[themeClasses.buttonSecondary, 'px-4 py-2 rounded transition-colors disabled:opacity-50']"
              >Cancel</button>
              <button
                type="submit"
                :disabled="isSubmitting"
                :class="[
                  themeClasses.buttonPrimary, 
                  'px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                ]"
              >
                <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isSubmitting ? 'Adding...' : 'Add' }}
              </button>
            </div>
          </form>
          <form v-else class="p-6 space-y-4">
            <div>
              <label :class="[themeClasses.muted, 'block text-sm font-medium mb-1']">CSV File</label>              <button
                type="button"
                @click="downloadCSVTemplate"
                :class="[
                  'mb-3 px-3 py-1 text-xs rounded transition-colors',
                  themeClasses.buttonPrimary
                ]"
              >
                Download CSV Template
              </button>
              <input 
                type="file" 
                accept=".csv" 
                @change="handleCSVUpload" 
                :disabled="isUploading"
                :class="[themeClasses.input, 'w-full disabled:opacity-50 disabled:cursor-not-allowed']" 
              />
              <div v-if="isUploading" :class="[themeClasses.textPrimary, 'text-sm mt-2 flex items-center gap-2']">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading and processing CSV...
              </div>
              <p :class="[themeClasses.muted, 'text-xs mt-2']">Format: <code>recitalist_name,guest_count</code> (one per line)</p>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="closeModal"
                :disabled="isUploading"
                :class="[themeClasses.buttonSecondary, 'px-4 py-2 rounded transition-colors disabled:opacity-50']"
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
        :class="['absolute inset-0', themeClasses.overlay]"
        @click="closePreviewModal"
      ></div>
      <!-- Modal content -->
      <div
        :class="[themeClasses.card, 'relative z-10 rounded-lg max-w-4xl w-full max-h-full overflow-auto border shadow-2xl']"
        @click.stop
      >
        <!-- Modal Header -->
        <div :class="['flex items-center justify-between p-6 border-b', themeClasses.border]">
          <h3 :class="[themeClasses.text, 'text-lg font-semibold']">
            <template v-if="previewMode === 'batch'">
              Ticket Preview - {{ selectedPerformerName }}
            </template>
            <template v-else>
              Ticket Preview - {{ singlePreviewTicket?.name || singlePreviewTicket?.created_by_name || 'Guest' }}
            </template>
          </h3>
          <button @click="closePreviewModal" :class="[themeClasses.muted, 'hover:text-red-400 transition-colors duration-200']">
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
        </div>        <!-- Modal Footer -->
        <div :class="['flex gap-3 p-6 border-t justify-end', themeClasses.border]">
          <template v-if="previewMode === 'batch'">            <button 
              @click="handleBatchDownload('pdf')"
              :class="[
                'inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
                themeClasses.buttonSuccess
              ]"
            >
              <DocumentArrowDownIcon class="w-4 h-4 mr-2" />
              Download All as PDF
            </button>
            <button 
              @click="handleBatchDownload('zip')"
              :class="[
                'inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
                themeClasses.buttonPrimary
              ]"
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
    <div v-if="showClaimerPrompt" :class="['fixed inset-0 flex items-center justify-center z-50 p-4', themeClasses.overlay]">
      <div :class="[themeClasses.card, 'rounded-xl max-w-md w-full shadow-2xl border relative']" @click.stop>
        <div class="p-6">
          <h3 :class="[themeClasses.text, 'text-lg font-semibold mb-4']">Claim Tickets</h3>
          <label :class="[themeClasses.muted, 'block text-sm font-medium mb-1']">Claimer Name</label>
          <input v-model="claimerName" :class="[themeClasses.input, 'w-full px-3 py-2 rounded mb-4']" />
          <div class="flex justify-end gap-2">
            <button @click="cancelClaim" :class="[themeClasses.buttonSecondary, 'px-4 py-2 rounded transition-colors']">Cancel</button>
            <button 
              @click="confirmClaim" 
              :disabled="!claimerName.trim()" 
              :class="[
                'px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                themeClasses.buttonSuccess
              ]"
            >
              Confirm            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <transition name="fade">
      <div v-if="showEditModal" :class="['fixed inset-0 flex items-center justify-center z-50 p-4', themeClasses.overlay]">
        <div :class="[themeClasses.card, 'rounded-xl max-w-2xl w-full shadow-2xl border relative max-h-[90vh] overflow-auto']" @click.stop>
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b', themeClasses.cardBorder]">
            <h3 :class="[themeClasses.textPrimary, 'text-lg font-semibold']">
              Edit Tickets - {{ editingGroup?.recitalist.name }}
            </h3>
            <button @click="closeEditModal" :class="[themeClasses.textMuted, 'hover:text-red-400 transition-colors duration-200']">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-6 space-y-6">
            <!-- Edit Recitalist Name -->
            <div>
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">Recitalist Name</label>
              <div class="flex gap-2">
                <input 
                  v-model="editForm.recitalist_name" 
                  :class="[themeClasses.input, 'flex-1 px-3 py-2 rounded-lg text-sm']"
                  placeholder="Enter recitalist name"
                />
                <button
                  @click="updateRecitalistName"
                  :class="[
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    themeClasses.buttonPrimary
                  ]"
                >
                  Update Name
                </button>
              </div>
            </div>

            <!-- Guest Tickets Management -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <label :class="[themeClasses.textSecondary, 'text-sm font-medium']">
                  Guest Tickets ({{ editForm.guest_tickets.length }})
                </label>
                <div class="flex items-center gap-2">
                  <input 
                    v-model.number="newGuestCount"
                    type="number"
                    min="0"
                    max="10"
                    :class="[themeClasses.input, 'w-20 px-2 py-1 rounded text-sm']"
                    placeholder="0"
                  />
                  <button
                    @click="addGuestTickets"
                    :disabled="newGuestCount <= 0"
                    :class="[
                      'px-3 py-1 text-sm font-medium rounded transition-colors disabled:opacity-50',
                      themeClasses.buttonSuccess
                    ]"
                  >
                    Add Guests
                  </button>
                </div>
              </div>

              <!-- Guest Tickets List -->
              <div v-if="editForm.guest_tickets.length > 0" class="space-y-2 max-h-60 overflow-y-auto">
                <div 
                  v-for="guest in editForm.guest_tickets" 
                  :key="guest.id"
                  :class="[
                    themeClasses.card, 
                    'p-3 rounded-lg border flex items-center justify-between'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div :class="[
                      'w-2 h-2 rounded-full',
                      guest.status === 'unclaimed' ? 'bg-gray-400' :
                      guest.status === 'claimed' ? 'bg-yellow-400' : 'bg-green-400'
                    ]"></div>
                    <div>
                      <div :class="[themeClasses.textPrimary, 'text-sm font-medium']">Guest Ticket</div>
                      <div :class="[themeClasses.textMuted, 'text-xs']">
                        ID: {{ guest.id }} • Status: {{ guest.status }}
                      </div>
                    </div>
                  </div>
                  <button
                    @click="deleteGuestTicket(guest)"
                    :disabled="guest.status !== 'unclaimed'"
                    :class="[
                      'px-2 py-1 text-xs font-medium rounded transition-colors',
                      guest.status !== 'unclaimed' 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    ]"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div v-else :class="[themeClasses.textMuted, 'text-sm text-center py-4 italic']">
                No guest tickets
              </div>
            </div>

            <!-- Status Information -->
            <div :class="[themeClasses.card, 'p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20']">
              <div :class="[themeClasses.textPrimary, 'text-sm font-medium mb-2']">Quick Info:</div>
              <ul :class="[themeClasses.textMuted, 'text-xs space-y-1']">
                <li>• Only unclaimed tickets can be deleted</li>
                <li>• Guest tickets will inherit the updated recitalist name</li>
                <li>• Changes are saved immediately when you click the action buttons</li>
              </ul>
            </div>
          </div>

          <!-- Modal Footer -->
          <div :class="['flex justify-end gap-3 p-6 border-t', themeClasses.cardBorder]">
            <button
              @click="closeEditModal"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                themeClasses.buttonSecondary
              ]"
            >
              Close
            </button>
            <button
              @click="saveChanges"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                themeClasses.buttonPrimary
              ]"
            >
              Refresh & Close
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete Confirmation Modal -->
    <transition name="fade">
      <div v-if="showDeleteModal" :class="['fixed inset-0 flex items-center justify-center z-50 p-4', themeClasses.overlay]">
        <div :class="[themeClasses.card, 'rounded-xl max-w-md w-full shadow-2xl border relative']" @click.stop>
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b', themeClasses.cardBorder]">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 :class="[themeClasses.textPrimary, 'text-lg font-semibold']">Delete Recitalist</h3>
            </div>
            <button @click="closeDeleteModal" :class="[themeClasses.textMuted, 'hover:text-red-400 transition-colors duration-200']">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-6 space-y-4">
            <div v-if="groupToDelete" class="space-y-4">
              <!-- Warning Message -->
              <div :class="['p-4 rounded-lg border-l-4 border-red-500', 'bg-red-50 dark:bg-red-900/20']">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span :class="['font-semibold text-red-800 dark:text-red-200']">Warning: This action cannot be undone!</span>
                </div>
                <p :class="['text-sm text-red-700 dark:text-red-300']">
                  All tickets and their associated data will be permanently deleted.
                </p>
              </div>

              <!-- Deletion Details -->
              <div :class="[themeClasses.card, 'p-4 rounded-lg border space-y-3']">
                <h4 :class="[themeClasses.textPrimary, 'font-semibold text-base']">You are about to delete:</h4>
                
                <!-- Recitalist Info -->
                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <div :class="[themeClasses.textPrimary, 'font-medium']">{{ groupToDelete.recitalist.name }}</div>
                    <div :class="[themeClasses.textMuted, 'text-sm']">Recitalist Ticket</div>
                  </div>
                  <div class="ml-auto">
                    <span :class="[
                      'px-2 py-1 rounded-full text-xs font-medium',
                      groupToDelete.recitalist.status === 'unclaimed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                      groupToDelete.recitalist.status === 'claimed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    ]">
                      {{ groupToDelete.recitalist.status }}
                    </span>
                  </div>
                </div>

                <!-- Guest Tickets Info -->
                <div v-if="groupToDelete.guests.length > 0" class="space-y-2">
                  <div :class="[themeClasses.textSecondary, 'text-sm font-medium']">
                    {{ groupToDelete.guests.length }} Guest Ticket{{ groupToDelete.guests.length !== 1 ? 's' : '' }}:
                  </div>
                  <div class="max-h-32 overflow-y-auto space-y-1">
                    <div 
                      v-for="guest in groupToDelete.guests" 
                      :key="guest.id"
                      class="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded"
                    >
                      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div class="flex-1">
                        <div :class="[themeClasses.textMuted, 'text-sm']">Guest Ticket</div>
                      </div>
                      <span :class="[
                        'px-2 py-1 rounded-full text-xs font-medium',
                        guest.status === 'unclaimed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                        guest.status === 'claimed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      ]">
                        {{ guest.status }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Summary -->
                <div :class="['p-3 rounded-lg border-2 border-red-200 dark:border-red-800', 'bg-red-50 dark:bg-red-900/20']">
                  <div :class="['text-center font-semibold', 'text-red-800 dark:text-red-200']">
                    Total: {{ 1 + groupToDelete.guests.length }} ticket{{ (1 + groupToDelete.guests.length) !== 1 ? 's' : '' }} will be deleted
                  </div>
                </div>
              </div>

              <!-- Confirmation Input -->
              <div>
                <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">
                  Type "DELETE" to confirm this action:
                </label>
                <input 
                  v-model="deleteConfirmText"
                  type="text"
                  placeholder="Type DELETE here"
                  :class="[
                    themeClasses.input, 
                    'w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  ]"
                />
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div :class="['flex justify-end gap-3 p-6 border-t', themeClasses.cardBorder]">
            <button
              @click="closeDeleteModal"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                themeClasses.buttonSecondary
              ]"
            >
              Cancel
            </button>
            <button
              @click="confirmDeleteRecitalist"
              :disabled="deleteConfirmText !== 'DELETE'"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-red-600 hover:bg-red-700 text-white',
                'disabled:bg-gray-400 disabled:hover:bg-gray-400'
              ]"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </transition>
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