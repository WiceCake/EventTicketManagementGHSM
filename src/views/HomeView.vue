<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import {
  UsersIcon,
  TicketIcon,
  QrCodeIcon,
  PrinterIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MusicalNoteIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'

const stats = ref({
  total: 0,
  unclaimed: 0,
  claimed: 0,
  scanned: 0,
  recitalist: 0,
  guest: 0,
  distributed: 0,
  remaining: 0,
  max: 0,
  event: {},
})
const recentLogs = ref([])

async function fetchStats() {
  // Get event info (assuming only one active event)
  const { data: event } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  stats.value.event = event || {}

  // Get ticket stats
  const { data: ticketStats } = await supabase
    .from('ticket_stats')
    .select('*')
    .maybeSingle()
  if (ticketStats) {
    stats.value = {
      ...stats.value,
      total: ticketStats.total_tickets,
      unclaimed: ticketStats.unclaimed_tickets,
      claimed: ticketStats.claimed_tickets,
      scanned: ticketStats.scanned_tickets,
      recitalist: ticketStats.recitalist_tickets,
      guest: ticketStats.guest_tickets,
      distributed: ticketStats.tickets_distributed,
      remaining: ticketStats.remaining_tickets,
      max: ticketStats.max_tickets,
      event: event || {},
    }
  }
}

async function fetchRecentLogs() {
  const { data } = await supabase
    .from('ticket_logs')
    .select('*, users: user_id (full_name, email), tickets: ticket_id (name)')
    .order('created_at', { ascending: false })
    .limit(5)
  recentLogs.value = data || []
}

onMounted(() => {
  fetchStats()
  fetchRecentLogs()
})
</script>

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div class="max-w-4xl mx-auto">
      <!-- Dashboard Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-700 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2 tracking-tight">Dashboard</h1>
          <p class="text-gray-400 text-lg">
            {{ stats.event.event_name || 'Event' }}
            <span v-if="stats.event.event_date"> — {{ new Date(stats.event.event_date).toLocaleDateString() }}</span>
            <span v-if="stats.event.venue_name"> | {{ stats.event.venue_name }}</span>
          </p>
        </div>
      </div>
      <!-- Stats Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-blue-700 p-6 flex flex-col items-center">
          <div class="text-blue-400 text-3xl font-bold">{{ stats.total }}</div>
          <div class="text-blue-200 mt-2 font-semibold">Total Tickets</div>
        </div>
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-yellow-700 p-6 flex flex-col items-center">
          <div class="text-yellow-400 text-3xl font-bold">{{ stats.claimed }}</div>
          <div class="text-yellow-200 mt-2 font-semibold">Claimed</div>
        </div>
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-green-700 p-6 flex flex-col items-center">
          <div class="text-green-400 text-3xl font-bold">{{ stats.scanned }}</div>
          <div class="text-green-200 mt-2 font-semibold">Scanned</div>
        </div>
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-gray-700 p-6 flex flex-col items-center">
          <div class="text-gray-300 text-3xl font-bold">{{ stats.unclaimed }}</div>
          <div class="text-gray-300 mt-2 font-semibold">Unclaimed</div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-purple-700 p-6 flex flex-col items-center">
          <div class="text-purple-400 text-3xl font-bold">{{ stats.recitalist }}</div>
          <div class="text-purple-200 mt-2 font-semibold">Recitalist Tickets</div>
        </div>
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-pink-700 p-6 flex flex-col items-center">
          <div class="text-pink-400 text-3xl font-bold">{{ stats.guest }}</div>
          <div class="text-pink-200 mt-2 font-semibold">Guest Tickets</div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-blue-700 p-6 flex flex-col items-center">
          <div class="text-blue-400 text-3xl font-bold">{{ stats.distributed }}</div>
          <div class="text-blue-200 mt-2 font-semibold">Distributed</div>
        </div>
        <div class="bg-[#181f2a] rounded-2xl shadow border-2 border-green-700 p-6 flex flex-col items-center">
          <div class="text-green-400 text-3xl font-bold">{{ stats.remaining }}</div>
          <div class="text-green-200 mt-2 font-semibold">Remaining</div>
        </div>
      </div>
      <!-- Recent Activity Logs -->
      <div class="bg-[#232b3b] rounded-2xl shadow-2xl border border-blue-700 p-8">
        <h2 class="text-2xl font-bold text-white mb-5">Recent Activity</h2>
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
              <tr v-for="log in recentLogs" :key="log.id" class="border-b border-blue-900 hover:bg-[#232b3b] transition">
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
              <tr v-if="recentLogs.length === 0">
                <td colspan="5" class="text-center py-8 text-gray-500">
                  <div class="flex flex-col items-center">
                    <QrCodeIcon class="w-12 h-12 mb-2 text-gray-400" />
                    <span>No recent activity</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
</style>