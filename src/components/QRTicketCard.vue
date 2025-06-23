<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import QRCode from 'qrcode'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { useTheme } from '../composables/useTheme'

const { themeClasses } = useTheme()

const props = defineProps({
  ticket: Object,
  color: String
})

const qrCanvas = ref(null)
const cardRef = ref(null)
const actionsRef = ref(null)
const exportContainer = ref(null)

const ticketTypeLabel = computed(() =>
  props.ticket?.ticket_type === 'recitalist' ? 'Recitalist' : 'Guest'
)
const ticketName = computed(() =>
  props.ticket?.name || props.ticket?.created_by_name || 'Guest'
)

// Ticket status label and class
const statusLabel = computed(() => {
  switch (props.ticket?.status) {
    case 'unclaimed': return 'Unclaimed';
    case 'claimed': return 'Claimed';
    case 'scanned': return 'Scanned';
    default: return props.ticket?.status || 'Unknown';
  }
})
const statusClass = computed(() => {
  switch (props.ticket?.status) {
    case 'unclaimed': return 'bg-gray-500 text-white';
    case 'claimed': return 'bg-yellow-500 text-white';
    case 'scanned': return 'bg-green-600 text-white';
    default: return 'bg-gray-400 text-white';
  }
})

function drawQR(size = 150) {
  if (props.ticket?.id && qrCanvas.value) {
    QRCode.toCanvas(qrCanvas.value, JSON.stringify({ id: props.ticket.id }), {
      width: size,
      margin: 1,
      color: { 
        dark: themeClasses.value.background.includes('dark') ? '#fff' : '#000',
        light: themeClasses.value.background.includes('dark') ? '#232b3b' : '#ffffff'
      }
    })
    // Always keep CSS size at 160px
    qrCanvas.value.style.width = '160px'
    qrCanvas.value.style.height = '160px'
  }
}

onMounted(() => drawQR())
watch(() => props.ticket?.id, () => drawQR())

let removedActions = null
let removedMargin = null

// Expose for batch download
async function prepareForExport() {
  // Remove the actions DOM node
  const actions = actionsRef.value
  const parent = actions.parentNode
  removedActions = { actions, parent, next: actions.nextSibling }

  parent.removeChild(actions)

  // Remove margin/gap from the card if present
  removedMargin = cardRef.value.className
  cardRef.value.className = cardRef.value.className
    .replace(/\bgap-\S+\b/g, '')
    .replace(/\bmt-\S+\b/g, '')
    .replace(/\bmb-\S+\b/g, '')

  drawQR(150)
  await nextTick()
}

function restoreAfterExport() {
  // Restore the actions DOM node
  if (removedActions && removedActions.parent && removedActions.actions) {
    if (removedActions.next) {
      removedActions.parent.insertBefore(removedActions.actions, removedActions.next)
    } else {
      removedActions.parent.appendChild(removedActions.actions)
    }
  }
  // Restore margin/gap classes
  if (removedMargin) cardRef.value.className = removedMargin

  drawQR()
}

// Remove actions (buttons) from view
function removeActions() {
  if (actionsRef.value) actionsRef.value.classList.add('hidden')
}
// Restore actions (buttons) to view
function restoreActions() {
  if (actionsRef.value) actionsRef.value.classList.remove('hidden')
}

defineExpose({
  cardRef,
  prepareForExport,
  restoreAfterExport,
  removeActions,
  restoreActions
})

async function downloadCardAsImage() {
  if (!cardRef.value) return
  actionsRef.value.classList.add('hidden')
  drawQR(150)
  qrCanvas.value.style.width = '160px'
  qrCanvas.value.style.height = '160px'
  await nextTick()
  const canvas = await html2canvas(cardRef.value, { backgroundColor: null })
  drawQR()
  actionsRef.value.classList.remove('hidden')
  const link = document.createElement('a')
  link.download = `ticket-${props.ticket.id}.png`
  link.href = canvas.toDataURL()
  link.click()
}

async function downloadCardAsPDF() {
  if (!exportContainer.value) return

  actionsRef.value.classList.add('hidden')
  exportContainer.value.classList.add('card-export-scale')
  await nextTick()

  // Calculate scaled size
  const rect = cardRef.value.getBoundingClientRect()
  const scale = 1.4
  exportContainer.value.style.width = rect.width * scale + 'px'
  exportContainer.value.style.height = rect.height * scale + 'px'

  const canvas = await html2canvas(exportContainer.value, { backgroundColor: null })

  exportContainer.value.classList.remove('card-export-scale')
  exportContainer.value.style.width = ''
  exportContainer.value.style.height = ''
  actionsRef.value.classList.remove('hidden')

  // PDF setup: A4 size in px at 96dpi: 794 x 1123
  const pageWidth = 794
  const pageHeight = 1123
  const imgWidth = Math.min(canvas.width, pageWidth * 0.8)
  const imgHeight = (canvas.height / canvas.width) * imgWidth

  const x = (pageWidth - imgWidth) / 2
  const y = (pageHeight - imgHeight) / 2

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight]
  })
  pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight)
  pdf.save(`ticket-${props.ticket.id}.pdf`)
}

const showClaimerPrompt = ref(false)
const claimerName = ref('')

async function handleSingleDownload() {
  if (!props.ticket.claimed_by) {
    showClaimerPrompt.value = true
  } else {
    downloadCardAsImage()
  }
}

async function confirmClaim() {
  const now = new Date().toISOString()
  if (props.ticket.status !== 'unclaimed') {
    showClaimerPrompt.value = false
    claimerName.value = ''
    downloadCardAsImage()
    return
  }
  await supabase
    .from('tickets')
    .update({
      claimed_by: claimerName.value,
      claimed_at: now,
      status: 'claimed'
    })
    .eq('id', props.ticket.id)
  await supabase.from('ticket_logs').insert({
    ticket_id: props.ticket.id,
    action: 'claimed',
    notes: `Ticket claimed by ${claimerName.value}`
  })
  showClaimerPrompt.value = false
  claimerName.value = ''
  // Optionally refresh ticket data here
  downloadCardAsImage()
}
function cancelClaim() {
  showClaimerPrompt.value = false
  claimerName.value = ''
}
</script>

<template>
  <div ref="exportContainer" class="inline-block">
    <div
      ref="cardRef"
      :id="`card-${ticket.id}`"
      :class="[themeClasses.card, 'max-w-xs w-full rounded-xl shadow-lg flex flex-col items-center p-4 border']"
    >
      <div :class="[themeClasses.text, 'font-bold mb-2 tracking-wide']">SCAN ME</div>
      <div class="w-40 h-40 flex justify-center items-center mb-2">
        <canvas ref="qrCanvas" class="w-40 h-40" />
      </div>
      <div class="text-center mb-2">
        <div :class="[themeClasses.muted, 'font-semibold text-sm']">{{ ticketTypeLabel }}</div>
        <div :class="[themeClasses.text, 'text-lg font-bold']">{{ ticketName }}</div>
        <div :class="[themeClasses.muted, 'text-xs break-all']">ID: {{ ticket.id }}</div>
        <div v-if="ticket.manual_code" class="text-xs font-mono text-blue-400 mt-1">Manual Code: <span class="font-bold">{{ ticket.manual_code }}</span></div>
      </div>

      <div ref="actionsRef" class="flex flex-col gap-2 w-full mt-2">
        <button @click="handleSingleDownload" class="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1 text-sm font-medium w-full transition-colors">
          Download as Image
        </button>
        <!--
        <button @click="downloadCardAsPDF" class="bg-green-600 hover:bg-green-700 text-white rounded px-4 py-1 text-sm font-medium w-full">Download as PDF</button>
        -->
      </div>
    </div>

    <div v-if="showClaimerPrompt" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div :class="[themeClasses.card, 'rounded-xl max-w-md w-full shadow-2xl border relative']" @click.stop>
        <div class="p-6">
          <h3 :class="[themeClasses.text, 'text-lg font-semibold mb-4']">Claim Ticket</h3>
          <label :class="[themeClasses.muted, 'block text-sm font-medium mb-1']">Claimer Name</label>
          <input v-model="claimerName" :class="[themeClasses.input, 'w-full px-3 py-2 rounded mb-4']" />
          <div class="flex justify-end gap-2">
            <button @click="cancelClaim" :class="[themeClasses.buttonSecondary, 'px-4 py-2 rounded transition-colors']">Cancel</button>
            <button @click="confirmClaim" :disabled="!claimerName.trim()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Add this to your global CSS or <style> block */
.card-export-scale {
  transform: scale(1.4);
  transform-origin: top left;
}
</style>