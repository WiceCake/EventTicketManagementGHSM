<script setup>
import { ref, onMounted, computed } from "vue";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../composables/useTheme";
import {
  QrCodeIcon,
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from "@heroicons/vue/24/outline";
import { QrcodeStream } from "vue-qrcode-reader";
// import { QrcodeStream } from 'vue3-qr-barcode-scanner'

const { themeClasses } = useTheme();

const isCameraActive = ref(false);
const loading = ref(false);
const processing = ref(false);
const manualTicketId = ref("");
const scannerContainer = ref(null);
const lastScanResult = ref(null);
const recentScans = ref([]);
const stats = ref({
  totalScanned: 0,
  validTickets: 0,
  invalidTickets: 0,
});
const activeEvent = ref(null);
const toast = ref({ show: false, message: "", success: true });

// Batch scan functionality
const showBatchScanModal = ref(false);
const batchSearchQuery = ref('');
const selectedTickets = ref([]);
const availableTickets = ref([]);
const isBatchProcessing = ref(false);
const batchResults = ref({ success: 0, failed: 0, details: [] });

const canScan = computed(
  () => activeEvent.value && !activeEvent.value.is_finished
);

async function fetchActiveEvent() {
  const { data } = await supabase
    .from("event_config")
    .select("*")
    .eq("is_active", true)
    .eq("is_finished", false)
    .maybeSingle();
  if (data) activeEvent.value = data;
}

async function fetchScanStats() {
  if (!activeEvent.value) return;

  // Only 'scanned' and 'invalid' actions for this event
  const { count: totalScanned } = await supabase
    .from("ticket_logs")
    .select("id, tickets!inner(event_id)", { count: "exact", head: true })
    .in("action", ["scanned", "invalid"])
    .eq("tickets.event_id", activeEvent.value.id);

  const { count: validTickets } = await supabase
    .from("ticket_logs")
    .select("id, tickets!inner(event_id)", { count: "exact", head: true })
    .eq("action", "scanned")
    .eq("tickets.event_id", activeEvent.value.id);

  const { count: invalidTickets } = await supabase
    .from("ticket_logs")
    .select("id, tickets!inner(event_id)", { count: "exact", head: true })
    .eq("action", "invalid")
    .eq("tickets.event_id", activeEvent.value.id);

  stats.value = {
    totalScanned: totalScanned || 0,
    validTickets: validTickets || 0,
    invalidTickets: invalidTickets || 0,
  };

  // Recent scans: only 'scanned' and 'invalid'
  const { data: logs } = await supabase
    .from("ticket_logs")
    .select("*, tickets!inner(event_id, name)")
    .in("action", ["scanned", "invalid"])
    .eq("tickets.event_id", activeEvent.value.id)
    .order("created_at", { ascending: false })
    .limit(10);

  recentScans.value = (logs || []).map((log) => ({
    id: log.id,
    ticketId: log.ticket_id,
    status: log.action,
    attendeeName: log.tickets?.name || "",
    timestamp: new Date(log.created_at),
    success: log.action === "scanned",
  }));
}

// Scanner logic (pseudo, replace with real QR scanner library)
const startCamera = async () => {
  isCameraActive.value = true;
};
const stopCamera = async () => {
  isCameraActive.value = false;
};
const toggleCamera = async () => {
  loading.value = true;
  if (isCameraActive.value) await stopCamera();
  else await startCamera();
  loading.value = false;
};

function showToast(message, success = true) {
  toast.value = { show: true, message, success };
  setTimeout(() => {
    toast.value.show = false;
  }, 2500);
}

// Process scanned or manually entered ticket
async function processTicket(ticketInput) {
  if (!activeEvent.value) {
    showToast("No active event found. Cannot process tickets.", false);
    return;
  }

  let ticket = null;
  // Try by manual_code first
  const { data: byCode } = await supabase
    .from("tickets")
    .select("*")
    .eq("manual_code", ticketInput)
    .eq("event_id", activeEvent.value.id)
    .maybeSingle();
  if (byCode) {
    ticket = byCode;
  } else {
    // Try by id (UUID)
    const { data: byId } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketInput)
      .eq("event_id", activeEvent.value.id)
      .maybeSingle();
    if (byId) ticket = byId;
  }

  if (!ticket) {
    await supabase.from("ticket_logs").insert({
      ticket_id: ticketInput,
      action: "invalid",
      notes: "Ticket not found",
    });
    lastScanResult.value = {
      ticketId: ticketInput,
      attendeeName: "",
      timestamp: new Date(),
      success: false,
      message: "Ticket not found.",
    };
    showToast("Ticket not found.", false);
    await fetchScanStats();
    return;
  }

  if (ticket.status === "scanned") {
    await supabase.from("ticket_logs").insert({
      ticket_id: ticket.id,
      action: "invalid", // log as invalid for stats
      notes: "Ticket already scanned.",
    });
    lastScanResult.value = {
      ticketId: ticket.manual_code || ticket.id,
      attendeeName: ticket.name || "",
      timestamp: new Date(),
      success: false,
      message: "Ticket already scanned.",
    };
    showToast("Ticket already scanned.", false);
    await fetchScanStats();
    return;
  }

  if (ticket.status === "unclaimed") {
    await supabase.from("ticket_logs").insert({
      ticket_id: ticket.id,
      action: "invalid", // log as invalid for stats
      notes: "Ticket not yet claimed.",
    });
    lastScanResult.value = {
      ticketId: ticket.manual_code || ticket.id,
      attendeeName: ticket.name || "",
      timestamp: new Date(),
      success: false,
      message: "Ticket not yet claimed.",
    };
    showToast("Ticket not yet claimed.", false);
    await fetchScanStats();
    return;
  }

  // Mark as scanned
  const now = new Date().toISOString();
  await supabase
    .from("tickets")
    .update({
      scanned_at: now,
      status: "scanned",
    })
    .eq("id", ticket.id);
  await supabase.from("ticket_logs").insert({
    ticket_id: ticket.id,
    action: "checkin", // log as checkin for stats
    notes: "Ticket scanned at event",
  });
  lastScanResult.value = {
    ticketId: ticket.manual_code || ticket.id,
    attendeeName: ticket.name || "",
    timestamp: new Date(),
    success: true,
    message: "Ticket successfully scanned.",
  };
  showToast("Ticket successfully scanned.", true);
  await fetchScanStats();
}

// Manual entry
function processManualTicket() {
  if (!manualTicketId.value.trim()) return;
  processTicket(manualTicketId.value.trim().toUpperCase());
  manualTicketId.value = "";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

onMounted(async () => {
  await fetchActiveEvent();
  await fetchScanStats();
});

function onDetect([result]) {
  let ticketId = result?.rawValue || result;
  // If ticketId is a JSON string, parse it
  try {
    const parsed = JSON.parse(ticketId);
    if (parsed && parsed.id) ticketId = parsed.id;
  } catch (e) {
    // Not JSON, use as is
  }
  processTicket(ticketId);
  stopCamera();
}

function onManualCodeInput(e) {
  manualTicketId.value = e.target.value.toUpperCase();
}

// Batch scan functions
async function openBatchScanModal() {
  if (!activeEvent.value) {
    showToast("No active event found. Cannot open batch scan.", false);
    return;
  }
  
  await fetchAvailableTickets();
  selectedTickets.value = [];
  batchSearchQuery.value = '';
  batchResults.value = { success: 0, failed: 0, details: [] };
  showBatchScanModal.value = true;
}

function closeBatchScanModal() {
  showBatchScanModal.value = false;
  selectedTickets.value = [];
  batchSearchQuery.value = '';
  batchResults.value = { success: 0, failed: 0, details: [] };
}

async function fetchAvailableTickets() {
  if (!activeEvent.value) return;
  
  const { data } = await supabase
    .from("tickets")
    .select("*")
    .eq("event_id", activeEvent.value.id)
    .eq("status", "claimed") // Only claimed tickets can be scanned
    .order("name", { ascending: true });
    
  availableTickets.value = data || [];
}

const filteredTickets = computed(() => {
  if (!batchSearchQuery.value) return availableTickets.value;
  
  const query = batchSearchQuery.value.toLowerCase();
  return availableTickets.value.filter(ticket => 
    (ticket.name && ticket.name.toLowerCase().includes(query)) ||
    (ticket.manual_code && ticket.manual_code.toLowerCase().includes(query)) ||
    (ticket.created_by_name && ticket.created_by_name.toLowerCase().includes(query))
  );
});

function toggleTicketSelection(ticket) {
  const index = selectedTickets.value.findIndex(t => t.id === ticket.id);
  if (index > -1) {
    selectedTickets.value.splice(index, 1);
  } else {
    selectedTickets.value.push(ticket);
  }
}

function isTicketSelected(ticket) {
  return selectedTickets.value.some(t => t.id === ticket.id);
}

function selectAllFiltered() {
  const unselectedFiltered = filteredTickets.value.filter(ticket => 
    !isTicketSelected(ticket)
  );
  selectedTickets.value.push(...unselectedFiltered);
}

function deselectAll() {
  selectedTickets.value = [];
}

async function processBatchScan() {
  if (selectedTickets.value.length === 0) {
    showToast("Please select at least one ticket to scan.", false);
    return;
  }
  
  isBatchProcessing.value = true;
  const results = { success: 0, failed: 0, details: [] };
  
  try {
    for (const ticket of selectedTickets.value) {
      try {
        // Check if ticket is still in claimed status (might have changed)
        const { data: currentTicket } = await supabase
          .from("tickets")
          .select("status")
          .eq("id", ticket.id)
          .single();
          
        if (currentTicket.status !== "claimed") {
          results.failed++;
          results.details.push({
            ticket: ticket,
            success: false,
            message: currentTicket.status === "scanned" ? "Already scanned" : "Not claimable"
          });
          continue;
        }
        
        // Mark as scanned
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("tickets")
          .update({
            scanned_at: now,
            status: "scanned",
          })
          .eq("id", ticket.id);
          
        if (updateError) {
          results.failed++;
          results.details.push({
            ticket: ticket,
            success: false,
            message: "Database error"
          });
          continue;
        }
        
        // Log the scan
        await supabase.from("ticket_logs").insert({
          ticket_id: ticket.id,
          action: "scanned",
          notes: "Batch scan processed",
        });
        
        results.success++;
        results.details.push({
          ticket: ticket,
          success: true,
          message: "Successfully scanned"
        });
        
      } catch (error) {
        results.failed++;
        results.details.push({
          ticket: ticket,
          success: false,
          message: "Processing error"
        });
      }
    }
    
    batchResults.value = results;
    
    // Show summary toast
    if (results.failed === 0) {
      showToast(`Successfully scanned ${results.success} tickets!`, true);
    } else {
      showToast(`Scanned ${results.success} tickets. ${results.failed} failed.`, results.success > results.failed);
    }
    
    // Refresh data
    await fetchScanStats();
    await fetchAvailableTickets();
    
    // Clear selection
    selectedTickets.value = [];
    
  } finally {
    isBatchProcessing.value = false;
  }
}
</script>

<template>
  <div :class="['min-h-screen py-8 px-4', themeClasses.pageBackground]">
    <!-- Toast Notification -->
    <div
      v-if="toast.show"
      :class="[
        'fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all transform -translate-x-1/2',
        toast.success ? themeClasses.toastSuccess : themeClasses.toastError,
      ]"
    >
      {{ toast.message }}
    </div>
    <div class="max-w-7xl mx-auto">
      <div class="flex flex-col xl:flex-row gap-8">
        <!-- Left: Scanner Section -->
        <div class="w-full xl:w-[440px] flex-shrink-0 mx-auto xl:mx-0">
          <div
            :class="[
              'rounded-2xl shadow-xl border p-6 space-y-6',
              themeClasses.card,
              themeClasses.cardBorder,
            ]"
          >
            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1
                :class="[
                  'text-xl sm:text-2xl font-bold tracking-tight',
                  themeClasses.textPrimary,
                ]"
              >
                <QrCodeIcon class="w-6 h-6 sm:w-8 sm:h-8 inline-block mr-2 -mt-1" />
                Ticket Scanner
              </h1>
              <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  @click="openBatchScanModal"
                  :disabled="!canScan"
                  :class="[
                    'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-2 min-h-[40px]',
                    !canScan
                      ? themeClasses.paginationButtonDisabled
                      : themeClasses.buttonSuccess,
                  ]"
                >
                  <QueueListIcon class="w-4 h-4" />
                  <span>Batch Scan</span>
                </button>
                <button
                  @click="toggleCamera"
                  :disabled="loading || !canScan"
                  :class="[
                    'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm flex items-center justify-center gap-2 min-h-[40px]',
                    !canScan
                      ? themeClasses.paginationButtonDisabled
                      : isCameraActive
                      ? themeClasses.buttonDanger
                      : themeClasses.buttonPrimary,
                    loading && 'opacity-50 cursor-not-allowed',
                  ]"
                >
                  <CameraIcon class="w-4 h-4" />
                  <span v-if="loading">Loading...</span>
                  <span v-else-if="!canScan">No Event</span>
                  <span v-else>{{ isCameraActive ? "Stop" : "Start" }}</span>
                </button>
              </div>
            </div>

            <!-- Event Status -->
            <div
              v-if="!canScan"
              :class="['p-4 rounded-lg border', themeClasses.statusWarning]"
            >
              <p class="text-sm font-medium">
                {{
                  !activeEvent
                    ? "No active event found. Please set an event as active before scanning."
                    : "This event has finished. Scanning is no longer available."
                }}
              </p>
            </div>
            <!-- Camera Container -->
            <div
              :class="[
                'relative rounded-xl overflow-hidden border-2',
                'w-full max-w-[380px] h-[300px] md:h-[320px] lg:h-[340px] mx-auto',
                canScan
                  ? themeClasses.cameraActive
                  : themeClasses.cameraInactive,
              ]"
            >
              <QrcodeStream
                v-if="isCameraActive && canScan"
                @detect="onDetect"
                :paused="processing"
                class="w-full h-full object-cover rounded-lg"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center"
              >
                <div :class="['text-center', themeClasses.textMuted]">
                  <CameraIcon
                    :class="['w-20 h-20 mx-auto mb-4', themeClasses.textMuted]"
                  />
                  <p
                    :class="[
                      'text-xl font-semibold mb-3',
                      themeClasses.textPrimary,
                    ]"
                  >
                    {{ !canScan ? "Scanner Unavailable" : "Camera Inactive" }}
                  </p>
                  <p class="text-sm max-w-xs mx-auto leading-relaxed">
                    {{
                      !canScan
                        ? "Set an active event to enable scanning"
                        : 'Click "Start" to begin scanning tickets'
                    }}
                  </p>
                </div>
              </div>

              <!-- Scanning Overlay -->
              <div
                v-if="isCameraActive && canScan"
                class="absolute inset-0 pointer-events-none"
              >
                <div
                  :class="[
                    'absolute inset-8 border-2 rounded-lg shadow-lg',
                    'border-white/90 dark:border-white/70',
                  ]"
                >
                  <div
                    :class="[
                      'absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4',
                      'border-green-400 dark:border-green-500',
                    ]"
                  ></div>
                  <div
                    :class="[
                      'absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4',
                      'border-green-400 dark:border-green-500',
                    ]"
                  ></div>
                  <div
                    :class="[
                      'absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4',
                      'border-green-400 dark:border-green-500',
                    ]"
                  ></div>
                  <div
                    :class="[
                      'absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4',
                      'border-green-400 dark:border-green-500',
                    ]"
                  ></div>
                </div>
                <div
                  :class="[
                    'absolute top-1/2 left-0 right-0 h-0.5 animate-scan opacity-80',
                    'bg-red-500 dark:bg-red-400',
                  ]"
                ></div>
              </div>
            </div>

            <!-- Manual Input -->
            <div class="space-y-3">
              <label
                :class="[
                  'block text-sm font-medium',
                  themeClasses.textSecondary,
                ]"
              >
                Manual Ticket Entry
              </label>
              <div class="flex flex-col sm:flex-row gap-3">
                <input
                  v-model="manualTicketId"
                  type="text"
                  placeholder="Enter ticket ID"
                  :class="[
                    'flex-1 px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg',
                    themeClasses.input,
                  ]"
                  @keyup.enter="processManualTicket"
                  :disabled="processing || !canScan"
                  @input="onManualCodeInput"
                />
                <button
                  @click="processManualTicket"
                  :disabled="!manualTicketId.trim() || processing || !canScan"
                  :class="[
                    'px-6 py-3 text-sm rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full sm:w-auto flex-shrink-0',
                    themeClasses.buttonPrimary,
                  ]"
                >
                  Process
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Right: Stats and Recent Scans -->
        <div class="w-full flex-1 space-y-6 min-w-0">
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              :class="[
                'rounded-xl shadow-lg border p-6 transition-all hover:shadow-xl',
                themeClasses.card,
                themeClasses.cardBorder,
              ]"
            >
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-blue-600 shadow-lg">
                  <QrCodeIcon class="w-6 h-6 text-white" />
                </div>
                <div class="ml-4">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-blue-600"
                  >
                    Total Scanned
                  </p>
                  <p :class="['text-2xl font-bold', themeClasses.textPrimary]">
                    {{ stats.totalScanned }}
                  </p>
                </div>
              </div>
            </div>

            <div
              :class="[
                'rounded-xl shadow-lg border p-6 transition-all hover:shadow-xl',
                themeClasses.card,
                themeClasses.cardBorder,
              ]"
            >
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-green-600 shadow-lg">
                  <CheckCircleIcon class="w-6 h-6 text-white" />
                </div>
                <div class="ml-4">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-green-600"
                  >
                    Valid Tickets
                  </p>
                  <p :class="['text-2xl font-bold', themeClasses.textPrimary]">
                    {{ stats.validTickets }}
                  </p>
                </div>
              </div>
            </div>

            <div
              :class="[
                'rounded-xl shadow-lg border p-6 transition-all hover:shadow-xl',
                themeClasses.card,
                themeClasses.cardBorder,
              ]"
            >
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-red-600 shadow-lg">
                  <XCircleIcon class="w-6 h-6 text-white" />
                </div>
                <div class="ml-4">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-red-600"
                  >
                    Invalid Attempts
                  </p>
                  <p :class="['text-2xl font-bold', themeClasses.textPrimary]">
                    {{ stats.invalidTickets }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Scans -->
          <div
            :class="[
              'rounded-xl shadow-lg border flex-1 flex flex-col',
              themeClasses.card,
              themeClasses.cardBorder,
            ]"
          >
            <div class="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2
                :class="[
                  'text-xl font-bold flex items-center',
                  themeClasses.textPrimary,
                ]"
              >
                <ClockIcon class="w-5 h-5 mr-2" />
                Recent Activity
              </h2>
            </div>

            <div class="flex-1 p-6">
              <div
                v-if="!canScan"
                :class="['text-center py-12', themeClasses.textMuted]"
              >
                <QrCodeIcon
                  :class="[
                    'w-12 h-12 mx-auto mb-3 opacity-50',
                    themeClasses.textMuted,
                  ]"
                />
                <p class="text-lg font-medium">No Active Event</p>
                <p class="text-sm">Set an active event to view scan history</p>
              </div>

              <div
                v-else-if="recentScans.length === 0"
                :class="['text-center py-12', themeClasses.textMuted]"
              >
                <QrCodeIcon
                  :class="[
                    'w-12 h-12 mx-auto mb-3 opacity-50',
                    themeClasses.textMuted,
                  ]"
                />
                <p class="text-lg font-medium">No Recent Scans</p>
                <p class="text-sm">Scanned tickets will appear here</p>
              </div>

              <div v-else class="space-y-3 max-h-80 overflow-y-auto">
                <div
                  v-for="scan in recentScans"
                  :key="scan.id"
                  :class="[
                    'p-4 rounded-lg border transition-all hover:shadow-md',
                    scan.success
                      ? themeClasses.statusSuccess
                      : themeClasses.statusError,
                  ]"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <p
                        :class="[
                          'font-semibold text-sm',
                          themeClasses.textPrimary,
                        ]"
                      >
                        {{ scan.ticketId }}
                      </p>
                      <p
                        v-if="scan.attendeeName"
                        :class="['text-sm mt-1', themeClasses.textMuted]"
                      >
                        {{ scan.attendeeName }}
                      </p>
                    </div>
                    <div class="text-right">
                      <div
                        :class="[
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-bold shadow-sm',
                          scan.success
                            ? themeClasses.badgeSuccess
                            : themeClasses.badgeDanger,
                        ]"
                      >
                        {{ scan.success ? "Valid" : "Invalid" }}
                      </div>
                      <p
                        :class="[
                          'text-xs mt-1 font-medium',
                          themeClasses.textMuted,
                        ]"
                      >
                        {{ formatTime(scan.timestamp) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch Scan Modal -->
    <transition name="fade">
      <div v-if="showBatchScanModal" :class="['fixed inset-0 flex items-center justify-center z-50 p-4', themeClasses.overlay]">
        <div :class="[themeClasses.card, 'rounded-xl max-w-4xl w-full max-h-[95vh] shadow-2xl border relative flex flex-col']" @click.stop>
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b flex-shrink-0', themeClasses.cardBorder]">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <QrCodeIcon class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 :class="[themeClasses.textPrimary, 'text-xl font-semibold']">Batch Ticket Scanner</h3>
            </div>
            <button @click="closeBatchScanModal" :class="[themeClasses.textMuted, 'hover:text-red-400 transition-colors duration-200']">
              <XCircleIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 flex flex-col min-h-0">
            <!-- Search and Controls -->
            <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div class="space-y-4">
                <!-- Search Bar -->
                <div>
                  <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">
                    Search Tickets (Name, Code, or Recitalist)
                  </label>
                  <input
                    v-model="batchSearchQuery"
                    type="text"
                    placeholder="Type to search..."
                    :class="[
                      themeClasses.input,
                      'w-full px-4 py-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm'
                    ]"
                  />
                </div>

                <!-- Selection Controls -->
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      @click="selectAllFiltered"
                      :disabled="filteredTickets.length === 0"
                      :class="[
                        'px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
                        themeClasses.buttonSecondary
                      ]"
                    >
                      Select All Filtered ({{ filteredTickets.length }})
                    </button>
                    <button
                      @click="deselectAll"
                      :disabled="selectedTickets.length === 0"
                      :class="[
                        'px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
                        themeClasses.buttonSecondary
                      ]"
                    >
                      Deselect All
                    </button>
                  </div>
                  <div :class="[themeClasses.textSecondary, 'text-sm font-medium']">
                    {{ selectedTickets.length }} ticket{{ selectedTickets.length !== 1 ? 's' : '' }} selected
                  </div>
                </div>
              </div>
            </div>

            <!-- Tickets List -->
            <div class="flex-1 overflow-auto p-6 min-h-0">
              <div v-if="filteredTickets.length === 0" :class="['text-center py-12', themeClasses.textMuted]">
                <QrCodeIcon :class="['w-12 h-12 mx-auto mb-3 opacity-50', themeClasses.textMuted]" />
                <p class="text-lg font-medium">No claimable tickets found</p>
                <p class="text-sm">{{ batchSearchQuery ? 'Try adjusting your search' : 'All tickets may already be scanned' }}</p>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="ticket in filteredTickets"
                  :key="ticket.id"
                  @click="toggleTicketSelection(ticket)"
                  :class="[
                    'p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md',
                    isTicketSelected(ticket)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : themeClasses.cardBorder + ' ' + themeClasses.card
                  ]"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-2">
                        <div
                          :class="[
                            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                            isTicketSelected(ticket)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          ]"
                        >
                          <CheckCircleIcon v-if="isTicketSelected(ticket)" class="w-3 h-3 text-white" />
                        </div>
                        <span
                          :class="[
                            'px-2 py-1 rounded-full text-xs font-medium',
                            ticket.ticket_type === 'recitalist'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          ]"
                        >
                          {{ ticket.ticket_type === 'recitalist' ? 'Recitalist' : 'Guest' }}
                        </span>
                      </div>
                      
                      <h4 :class="[themeClasses.textPrimary, 'font-semibold text-sm mb-1 truncate']">
                        {{ ticket.name || ticket.created_by_name || 'Guest Ticket' }}
                      </h4>
                      
                      <div :class="[themeClasses.textMuted, 'text-xs space-y-1']">
                        <div>Code: <span class="font-mono">{{ ticket.manual_code }}</span></div>
                        <div v-if="ticket.ticket_type === 'guest' && ticket.created_by_name">
                          For: {{ ticket.created_by_name }}
                        </div>
                        <div v-if="ticket.claimed_by">
                          Claimed by: {{ ticket.claimed_by }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Batch Results -->
            <div v-if="batchResults.success > 0 || batchResults.failed > 0" :class="['p-6 border-t flex-shrink-0', themeClasses.cardBorder]">
              <h4 :class="[themeClasses.textPrimary, 'font-semibold mb-3']">Last Batch Results:</h4>
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div :class="['p-3 rounded-lg', 'bg-green-50 dark:bg-green-900/20']">
                  <div class="text-green-800 dark:text-green-200 text-sm font-medium">Successful</div>
                  <div class="text-green-900 dark:text-green-100 text-2xl font-bold">{{ batchResults.success }}</div>
                </div>
                <div :class="['p-3 rounded-lg', 'bg-red-50 dark:bg-red-900/20']">
                  <div class="text-red-800 dark:text-red-200 text-sm font-medium">Failed</div>
                  <div class="text-red-900 dark:text-red-100 text-2xl font-bold">{{ batchResults.failed }}</div>
                </div>
              </div>
              
              <!-- Detailed Results (scrollable) -->
              <div v-if="batchResults.details.length > 0" class="max-h-32 overflow-y-auto space-y-1">
                <div
                  v-for="(result, index) in batchResults.details"
                  :key="index"
                  :class="[
                    'flex items-center justify-between p-2 rounded text-xs',
                    result.success
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  ]"
                >
                  <span class="font-medium">{{ result.ticket.name || result.ticket.created_by_name || 'Guest' }}</span>
                  <span>{{ result.message }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div :class="['flex flex-col sm:flex-row justify-between items-center p-6 border-t gap-4 flex-shrink-0', themeClasses.cardBorder]">
            <div :class="[themeClasses.textMuted, 'text-sm order-2 sm:order-1']">
              {{ availableTickets.length }} total claimable tickets
            </div>
            <div class="flex gap-3 order-1 sm:order-2">
              <button
                @click="closeBatchScanModal"
                :disabled="isBatchProcessing"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
                  themeClasses.buttonSecondary
                ]"
              >
                Close
              </button>
              <button
                @click="processBatchScan"
                :disabled="selectedTickets.length === 0 || isBatchProcessing"
                :class="[
                  'px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
                  themeClasses.buttonSuccess
                ]"
              >
                <svg v-if="isBatchProcessing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isBatchProcessing ? 'Processing...' : `Scan ${selectedTickets.length} Ticket${selectedTickets.length !== 1 ? 's' : ''}` }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% {
    transform: translateY(0);
    opacity: 0.7;
  }
  50% {
    transform: translateY(calc(100% - 2px));
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 0.7;
  }
}

.animate-scan {
  animation: scan 2s ease-in-out infinite;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}

/* Fade transition for modal */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>