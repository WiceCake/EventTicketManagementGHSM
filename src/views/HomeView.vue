<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useTheme } from '../composables/useTheme'
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

const { themeClasses } = useTheme()

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
  // Get event info (only active and unfinished events)
  const { data: event } = await supabase
    .from('event_config')
    .select('*')
    .eq('is_active', true)
    .eq('is_finished', false)
    .maybeSingle()
  stats.value.event = event || {}

  // Only fetch ticket stats if there's an active event
  if (event) {
    // Fetch tickets directly from the tickets table for this event
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status, ticket_type')
      .eq('event_id', event.id)

    if (tickets) {
      // Calculate stats from actual ticket data
      const total = tickets.length
      const unclaimed = tickets.filter(t => t.status === 'unclaimed').length
      const claimed = tickets.filter(t => t.status === 'claimed').length
      const scanned = tickets.filter(t => t.status === 'scanned').length
      const recitalist = tickets.filter(t => t.ticket_type === 'recitalist').length
      const guest = tickets.filter(t => t.ticket_type === 'guest').length
      const distributed = claimed + scanned
      const remaining = event.max_tickets - total

      stats.value = {
        ...stats.value,
        total: total,
        unclaimed: unclaimed,
        claimed: claimed,
        scanned: scanned,
        recitalist: recitalist,
        guest: guest,
        distributed: distributed,
        remaining: Math.max(0, remaining),
        max: event.max_tickets,
        event: event,
      }
    }
  } else {
    // Reset stats if no active event
    stats.value = {
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
    }
  }
}

async function fetchRecentLogs() {
  // Get active event first
  const { data: event } = await supabase
    .from('event_config')
    .select('id')
    .eq('is_active', true)
    .eq('is_finished', false)
    .maybeSingle()

  if (event) {
    // Fetch logs only for the active event
    const { data } = await supabase
      .from('ticket_logs')
      .select('*, users: user_id (full_name, email), tickets: ticket_id (name, event_id)')
      .eq('tickets.event_id', event.id)
      .order('created_at', { ascending: false })
      .limit(5)
    recentLogs.value = data || []
  } else {
    // No active event, show general recent logs
    const { data } = await supabase
      .from('ticket_logs')
      .select('*, users: user_id (full_name, email), tickets: ticket_id (name)')
      .order('created_at', { ascending: false })
      .limit(5)
    recentLogs.value = data || []
  }
}

onMounted(() => {
  fetchStats()
  fetchRecentLogs()
})
</script>

<template>
  <div :class="['min-h-screen py-10 px-2', themeClasses.pageBackground]">
    <div class="max-w-4xl mx-auto">
      <!-- Dashboard Header -->
      <div :class="['flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b mb-8', themeClasses.cardBorder]">
        <div>
          <h1 :class="['text-3xl font-bold mb-2 tracking-tight', themeClasses.textPrimary]">Dashboard</h1>
          <p :class="['text-lg', themeClasses.textSecondary]">
            {{ stats.event.event_name || 'Event' }}
            <span v-if="stats.event.event_date"> — {{ new Date(stats.event.event_date).toLocaleDateString() }}</span>
            <span v-if="stats.event.venue_name"> | {{ stats.event.venue_name }}</span>
          </p>
        </div>
      </div>      <!-- Stats Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-blue-500 text-3xl font-bold">{{ stats.total }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Total Tickets</div>
        </div>
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-yellow-500 text-3xl font-bold">{{ stats.claimed }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Claimed</div>
        </div>
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-green-500 text-3xl font-bold">{{ stats.scanned }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Scanned</div>
        </div>
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div :class="['text-3xl font-bold', themeClasses.textMuted]">{{ stats.unclaimed }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textMuted]">Unclaimed</div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-purple-500 text-3xl font-bold">{{ stats.recitalist }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Recitalist Tickets</div>
        </div>
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-pink-500 text-3xl font-bold">{{ stats.guest }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Guest Tickets</div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-blue-500 text-3xl font-bold">{{ stats.distributed }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Distributed</div>
        </div>
        <div :class="['rounded-xl shadow-lg border p-6 flex flex-col items-center transition-all duration-200 hover:shadow-xl', themeClasses.cardBackground, themeClasses.cardBorder]">
          <div class="text-green-500 text-3xl font-bold">{{ stats.remaining }}</div>
          <div :class="['mt-2 font-semibold', themeClasses.textSecondary]">Remaining</div>
        </div>
      </div>      <!-- Recent Activity Logs -->
      <div :class="['rounded-xl shadow-lg border p-8', themeClasses.cardBackground, themeClasses.cardBorder]">
        <h2 :class="['text-2xl font-bold mb-5', themeClasses.textPrimary]">Recent Activity</h2>        <div class="overflow-x-auto rounded-lg">
          <table :class="['min-w-full rounded-lg', themeClasses.cardBackground]">
            <thead>
              <tr :class="['text-left text-sm border-b', themeClasses.textSecondary, themeClasses.cardBorder]">
                <th class="py-3 px-4">Timestamp</th>
                <th class="py-3 px-4">Action</th>
                <th class="py-3 px-4">Ticket</th>
                <th class="py-3 px-4">User</th>
                <th class="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in recentLogs" :key="log.id" :class="['border-b transition', themeClasses.tableRow, themeClasses.cardBorder]">
                <td :class="['py-2 px-4', themeClasses.textSecondary]">{{ new Date(log.created_at).toLocaleString() }}</td>                <td class="py-2 px-4">
                  <span
                    :class="[
                      'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                      log.action === 'checkin' || log.action === 'scanned'
                        ? themeClasses.statusSuccess
                        : log.action === 'invalid'
                        ? themeClasses.statusError
                        : log.action === 'claimed'
                        ? themeClasses.statusWarning
                        : themeClasses.statusInfo
                    ]"
                  >
                    {{ log.action.charAt(0).toUpperCase() + log.action.slice(1) }}
                  </span>
                </td>
                <td :class="['py-2 px-4', themeClasses.textPrimary]">
                  {{ log.tickets?.name || log.ticket_id }}
                </td>
                <td :class="['py-2 px-4', themeClasses.textPrimary]">
                  {{ log.users?.full_name || log.users?.email || '—' }}
                </td>
                <td :class="['py-2 px-4', themeClasses.textMuted]">{{ log.notes }}</td>
              </tr>
              <tr v-if="recentLogs.length === 0">
                <td :class="['text-center py-8', themeClasses.textMuted]" colspan="5">
                  <div class="flex flex-col items-center">
                    <QrCodeIcon :class="['w-12 h-12 mb-2', themeClasses.textMuted]" />
                    <span>No recent activity</span>
                  </div>
                </td>
              </tr>            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>