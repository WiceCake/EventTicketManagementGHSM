<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../../lib/supabase'
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

async function fetchLogs() {
  loading.value = true
  let query = supabase
    .from('ticket_logs')
    .select('*, users: user_id (full_name, email), tickets: ticket_id (name)')
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
    .select('*, users: user_id (full_name, email), tickets: ticket_id (name)', { count: 'exact' })

  logs.value = data || []
  total.value = count || 0
  loading.value = false
}

onMounted(fetchLogs)
watch([page, actionFilter, search], fetchLogs)
</script>

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div class="max-w-4xl mx-auto">
      <div class="bg-[#232b3b] rounded-2xl shadow-2xl border border-blue-700 p-8 mb-8">
        <h1 class="text-3xl font-extrabold text-white mb-6">Scan History</h1>
        <div class="flex flex-col md:flex-row md:items-end gap-4 mb-6">
          <div class="flex-1">
            <label class="block text-sm text-gray-300 mb-1">Search</label>
            <input
              v-model="search"
              type="text"
              placeholder="Search by notes, user, or ticket"
              class="w-full px-4 py-2 border border-gray-700 rounded-md text-base bg-[#181f2a] text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1">Action</label>
            <select
              v-model="actionFilter"
              class="w-full px-4 py-2 border border-gray-700 rounded-md text-base bg-[#181f2a] text-white"
            >
              <option v-for="a in actions" :key="a.value" :value="a.value">{{ a.label }}</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto rounded-lg">
          <table class="min-w-full bg-[#181f2a] rounded-lg">
            <thead>
              <tr class="text-left text-gray-400 text-sm border-b border-blue-700">
                <th class="py-3 px-4">Timestamp</th>
                <th class="py-3 px-4">Action</th>
                <th class="py-3 px-4">Ticket</th>
                <th class="py-3 px-4">User</th>
                <th class="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id" class="border-b border-blue-900 hover:bg-[#232b3b] transition">
                <td class="py-2 px-4 text-gray-300">{{ new Date(log.created_at).toLocaleString() }}</td>
                <td class="py-2 px-4">
                  <span
                    :class="[
                      'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                      log.action === 'checkin' || log.action === 'scanned'
                        ? 'bg-green-100 text-green-800'
                        : log.action === 'invalid'
                        ? 'bg-red-100 text-red-800'
                        : log.action === 'claimed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    ]"
                  >
                    {{ log.action.charAt(0).toUpperCase() + log.action.slice(1) }}
                  </span>
                </td>
                <td class="py-2 px-4 text-gray-200">
                  {{ log.tickets?.name || log.ticket_id }}
                </td>
                <td class="py-2 px-4 text-gray-200">
                  {{ log.users?.full_name || log.users?.email || '—' }}
                </td>
                <td class="py-2 px-4 text-gray-400">{{ log.notes }}</td>
              </tr>
              <tr v-if="!loading && logs.length === 0">
                <td colspan="5" class="text-center py-8 text-gray-500">
                  <div class="flex flex-col items-center">
                    <QrCodeIcon class="w-12 h-12 mb-2 text-gray-400" />
                    <span>No logs found</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="flex justify-between items-center mt-6">
          <span class="text-gray-400 text-sm">
            Showing {{ (page - 1) * pageSize + 1 }} -
            {{ Math.min(page * pageSize, total) }} of {{ total }}
          </span>
          <div class="flex gap-2">
            <button
              @click="page = Math.max(1, page - 1)"
              :disabled="page === 1"
              class="px-4 py-2 rounded bg-blue-700 text-white font-semibold disabled:opacity-50"
            >Prev</button>
            <button
              @click="page = page + 1"
              :disabled="page * pageSize >= total"
              class="px-4 py-2 rounded bg-blue-700 text-white font-semibold disabled:opacity-50"
            >Next</button>
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