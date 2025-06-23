<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../composables/useTheme'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  TrashIcon,
  ClockIcon,
  QrCodeIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline';
import {
  CalendarDaysIcon,
  FaceFrownIcon
} from '@heroicons/vue/24/solid';

const { themeClasses } = useTheme()

// Reactive state
const searchQuery = ref('');
const selectedFilter = ref('all');
const selectedItems = ref([]);
const isLoading = ref(false);
const logs = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const search = ref('')
const actionFilter = ref('all')
const activeEvent = ref(null)

const actions = [
  { label: 'All', value: 'all' },
  { label: 'Check-in', value: 'checkin' },
  { label: 'Invalid', value: 'invalid' },
  { label: 'Created', value: 'created' },
  { label: 'Claimed', value: 'claimed' },
  { label: 'Scanned', value: 'scanned' }
]

// Mock data for demonstration
const mockScanHistory = [
  {
    id: 1,
    type: 'QR Code',
    content: 'https://github.com/vuejs/vue',
    scannedAt: '2025-06-14T10:30:00Z',
    status: 'success',
    location: 'Main Hall',
    deviceInfo: 'iPhone 14 Pro'
  },
  {
    id: 2,
    type: 'Student ID',
    content: 'GHSM-2024-001234',
    scannedAt: '2025-06-14T09:15:00Z',
    status: 'success',
    location: 'Music Room A',
    deviceInfo: 'iPad Pro'
  },
  {
    id: 3,
    type: 'QR Code',
    content: 'https://example.com/attendance/class-101',
    scannedAt: '2025-06-14T08:45:00Z',
    status: 'success',
    location: 'Practice Room 3',
    deviceInfo: 'Android Device'
  },
  {
    id: 4,
    type: 'ID Card',
    content: 'STAFF-GH-789012',
    scannedAt: '2025-06-13T16:20:00Z',
    status: 'failed',
    location: 'Office',
    deviceInfo: 'iPhone 14 Pro'
  },
  {
    id: 5,
    type: 'QR Code',
    content: 'PAYMENT-TXN-567890123',
    scannedAt: '2025-06-13T14:10:00Z',
    status: 'success',
    location: 'Front Desk',
    deviceInfo: 'iPad Pro'
  },
  {
    id: 6,
    type: 'Student ID',
    content: 'GHSM-2024-005678',
    scannedAt: '2025-06-13T11:30:00Z',
    status: 'success',
    location: 'Library',
    deviceInfo: 'Android Device'
  }
];

// Computed properties
const filteredHistory = computed(() => {
  let filtered = mockScanHistory;

  // Apply search filter
  if (searchQuery.value) {
    filtered = filtered.filter(item =>
      item.content.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  // Apply status filter
  if (selectedFilter.value !== 'all') {
    filtered = filtered.filter(item => item.status === selectedFilter.value);
  }

  return filtered;
});

const totalScans = computed(() => mockScanHistory.length);
const successfulScans = computed(() => mockScanHistory.filter(item => item.status === 'success').length);
const failedScans = computed(() => mockScanHistory.filter(item => item.status === 'failed').length);

// Methods
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    // You could add a toast notification here
  } catch (err) {
    // Handle error
  }
};

const deleteItem = (id) => {
  // This would be implemented with actual data management
};

const selectItem = (id) => {
  const index = selectedItems.value.indexOf(id);
  if (index === -1) {
    selectedItems.value.push(id);
  } else {
    selectedItems.value.splice(index, 1);
  }
};

const selectAll = () => {
  if (selectedItems.value.length === filteredHistory.value.length) {
    selectedItems.value = [];
  } else {
    selectedItems.value = filteredHistory.value.map(item => item.id);
  }
};

const deleteSelected = () => {
  // This would be implemented with actual data management
  selectedItems.value = [];
};

const refreshHistory = () => {
  isLoading.value = true;
  // Simulate API call
  setTimeout(() => {
    isLoading.value = false;
  }, 1000);
};

async function fetchActiveEvent() {
  const { data } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_active', true)
    .eq('is_finished', false)
    .maybeSingle()
  if (data) activeEvent.value = data
}

async function fetchLogs() {
  loading.value = true
  
  if (!activeEvent.value) {
    logs.value = []
    total.value = 0
    loading.value = false
    return
  }

  let query = supabase
    .from('ticket_logs')
    .select('*, users: user_id (full_name, email), tickets: ticket_id (name, event_id)')
    .eq('tickets.event_id', activeEvent.value.id)
    .order('created_at', { ascending: false })
    .range((page.value - 1) * pageSize, page.value * pageSize - 1)

  if (actionFilter.value !== 'all') {
    query = query.eq('action', actionFilter.value)
  }
  if (search.value.trim()) {
    // Search by ticket name or user name/email
    query = query.ilike('notes', `%${search.value.trim()}%`)
  }

  const { data, count } = await query
    .select('*, users: user_id (full_name, email), tickets: ticket_id (name, event_id)', { count: 'exact' })

  logs.value = data || []
  total.value = count || 0
  loading.value = false
}

onMounted(async () => {
  await fetchActiveEvent()
  await fetchLogs()
})
watch([page, actionFilter, search], fetchLogs)
</script>

<template>  <div :class="[themeClasses.pageBackground, 'min-h-screen py-8 px-4']">
    <div class="max-w-6xl mx-auto space-y-6">
      <div :class="[themeClasses.card, themeClasses.cardBorder, 'rounded-2xl shadow-xl p-8 space-y-6']">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h1 :class="[themeClasses.textPrimary, 'text-3xl font-bold flex items-center']">
            <ClockIcon class="w-8 h-8 mr-3" />
            Ticket History
          </h1>
          <button
            @click="refreshHistory"
            :disabled="isLoading"
            :class="[
              'flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm',
              themeClasses.buttonSecondary,
              isLoading && 'opacity-50 cursor-not-allowed'
            ]"
          >
            <ArrowPathIcon :class="['w-4 h-4 mr-2', isLoading && 'animate-spin']" />
            Refresh
          </button>
        </div>          <!-- Filters (always visible and styled) -->
        <div class="space-y-6 pt-2">          <!-- Filters -->
          <div class="flex flex-col md:flex-row gap-6 pt-4">
            <div class="flex-1">
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-3']">Search</label>
              <input
                v-model="search"
                type="text"
                placeholder="Search by notes, user, or ticket..."
                :class="[
                  themeClasses.input, 
                  'w-full px-4 py-3 rounded-lg text-sm border-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-md hover:shadow-lg'
                ]"
              />
            </div>            <div class="w-full md:w-56">
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-3']">Filter by Action</label>
              <div class="relative">
                <select
                  v-model="actionFilter"
                  :class="[
                    themeClasses.select || themeClasses.input, 
                    'w-full px-4 py-3 pr-10 rounded-lg text-sm border-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-md hover:shadow-lg appearance-none cursor-pointer'
                  ]"
                >
                  <option v-for="a in actions" :key="a.value" :value="a.value">{{ a.label }}</option>
                </select>
                <!-- Custom dropdown arrow -->
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <FunnelIcon :class="[themeClasses.textMuted, 'w-4 h-4']" />
                </div>
              </div>
            </div>
          </div><!-- Table -->
          <div v-if="activeEvent" class="overflow-hidden rounded-lg border" :class="themeClasses.cardBorder">
            <div class="overflow-x-auto">
              <table :class="[themeClasses.card, 'min-w-full']">
                <thead>
                  <tr :class="[themeClasses.tableHeader, 'border-b']">
                    <th :class="[themeClasses.textSecondary, 'text-left py-4 px-6 text-sm font-semibold']">Timestamp</th>
                    <th :class="[themeClasses.textSecondary, 'text-left py-4 px-6 text-sm font-semibold']">Action</th>
                    <th :class="[themeClasses.textSecondary, 'text-left py-4 px-6 text-sm font-semibold']">Ticket</th>
                    <th :class="[themeClasses.textSecondary, 'text-left py-4 px-6 text-sm font-semibold']">User</th>
                    <th :class="[themeClasses.textSecondary, 'text-left py-4 px-6 text-sm font-semibold']">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="log in logs" 
                    :key="log.id" 
                    :class="[themeClasses.tableRow, 'border-b transition-colors hover:shadow-sm']"
                  >
                    <td :class="[themeClasses.textPrimary, 'py-4 px-6 text-sm']">
                      {{ new Date(log.created_at).toLocaleString() }}
                    </td>
                    <td class="py-4 px-6">
                      <span
                        :class="[
                          'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                          log.action === 'checkin' || log.action === 'scanned'
                            ? themeClasses.badgeSuccess
                            : log.action === 'invalid'
                            ? themeClasses.badgeDanger
                            : log.action === 'claimed'
                            ? themeClasses.badgeWarning
                            : themeClasses.badgePrimary
                        ]"
                      >
                        {{ log.action.charAt(0).toUpperCase() + log.action.slice(1) }}
                      </span>
                    </td>
                    <td :class="[themeClasses.textPrimary, 'py-4 px-6 text-sm font-medium']">
                      {{ log.tickets?.name || log.ticket_id }}
                    </td>
                    <td :class="[themeClasses.textPrimary, 'py-4 px-6 text-sm']">
                      {{ log.users?.full_name || log.users?.email || '—' }}
                    </td>
                    <td :class="[themeClasses.textMuted, 'py-4 px-6 text-sm']">{{ log.notes }}</td>
                  </tr>
                  
                  <!-- Empty State -->
                  <tr v-if="!loading && logs.length === 0">
                    <td colspan="5" class="text-center py-16">
                      <div class="flex flex-col items-center">
                        <FaceFrownIcon :class="[themeClasses.textMuted, 'w-12 h-12 mb-3 opacity-50']" />
                        <span :class="[themeClasses.textMuted, 'text-lg font-medium']">No logs found</span>
                        <span :class="[themeClasses.textMuted, 'text-sm mt-1']">Try adjusting your search or filter criteria</span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Loading State -->
                  <tr v-if="loading">
                    <td colspan="5" class="text-center py-16">
                      <div class="flex flex-col items-center">
                        <ArrowPathIcon :class="[themeClasses.textMuted, 'w-8 h-8 mb-3 animate-spin']" />
                        <span :class="[themeClasses.textMuted, 'text-lg font-medium']">Loading logs...</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- No Active Event Message (when no active event but search/filter are still available) -->
          <div v-if="!activeEvent" :class="[themeClasses.card, themeClasses.cardBorder, 'rounded-lg p-12 text-center']">
            <QrCodeIcon :class="[themeClasses.textMuted, 'w-16 h-16 mx-auto mb-4 opacity-50']" />
            <h3 :class="[themeClasses.textPrimary, 'text-xl font-semibold mb-2']">No Active Event</h3>
            <p :class="[themeClasses.textMuted, 'max-w-md mx-auto']">
              No active event found. Please set an event as active in the admin panel to view ticket logs and scan history.
            </p>
          </div><!-- Pagination -->
          <div v-if="activeEvent" class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
            <span :class="[themeClasses.textMuted, 'text-sm']">
              Showing {{ (page - 1) * pageSize + 1 }} - {{ Math.min(page * pageSize, total) }} of {{ total }} results
            </span>
            <div class="flex gap-2">
              <button
                @click="page = Math.max(1, page - 1)"
                :disabled="page === 1"
                :class="[
                  'px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm',
                  page === 1 ? themeClasses.paginationButtonDisabled : themeClasses.paginationButton
                ]"
              >
                Previous
              </button>
              <button
                @click="page = page + 1"
                :disabled="page * pageSize >= total"
                :class="[
                  'px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm',
                  page * pageSize >= total ? themeClasses.paginationButtonDisabled : themeClasses.paginationButton
                ]"
              >
                Next
              </button>
            </div>        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for table */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f9fafb;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f9fafb;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>