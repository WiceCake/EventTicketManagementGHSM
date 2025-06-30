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
            <div class="flex items-center justify-between">
              <h1
                :class="[
                  'text-2xl font-bold tracking-tight',
                  themeClasses.textPrimary,
                ]"
              >
                <QrCodeIcon class="w-8 h-8 inline-block mr-2 -mt-1" />
                Ticket Scanner
              </h1>
              <button
                @click="toggleCamera"
                :disabled="loading || !canScan"
                :class="[
                  'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm',
                  !canScan
                    ? themeClasses.paginationButtonDisabled
                    : isCameraActive
                    ? themeClasses.buttonDanger
                    : themeClasses.buttonPrimary,
                  loading && 'opacity-50 cursor-not-allowed',
                ]"
              >
                <CameraIcon class="w-4 h-4 inline-block mr-2" />
                <span v-if="loading">Loading...</span>
                <span v-else-if="!canScan">No Event</span>
                <span v-else>{{ isCameraActive ? "Stop" : "Start" }}</span>
              </button>
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
</style>