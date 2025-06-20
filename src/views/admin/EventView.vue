<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const events = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')

const showModal = ref(false)
const isEditing = ref(false)
const editingEventId = ref(null)
const form = ref({
  event_name: '',
  event_date: '',
  venue_name: '',
  max_tickets: 1,
})

const toast = ref({ show: false, message: '', success: true })

function resetForm() {
  form.value = {
    event_name: '',
    event_date: '',
    venue_name: '',
    max_tickets: 1,
  }
  editingEventId.value = null
}

function openCreateModal() {
  resetForm()
  isEditing.value = false
  showModal.value = true
}

function openEditModal(event) {
  form.value = {
    event_name: event.event_name,
    event_date: event.event_date,
    venue_name: event.venue_name,
    max_tickets: event.max_tickets,
  }
  editingEventId.value = event.id
  isEditing.value = true
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchEvents() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('event_config')
    .select('*')
    .order('event_date', { ascending: false })
  if (err) error.value = err.message
  else events.value = data
  loading.value = false
}

function showToast(message, success = true) {
  toast.value = { show: true, message, success }
  setTimeout(() => { toast.value.show = false }, 2500)
}

async function createEvent() {
  error.value = ''
  const { error: err } = await supabase
    .from('event_config')
    .insert({
      event_name: form.value.event_name,
      event_date: form.value.event_date,
      venue_name: form.value.venue_name,
      max_tickets: form.value.max_tickets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: false,
    })
  if (err) {
    showToast(err.message, false)
  } else {
    showToast('Event created!', true)
    closeModal()
    await fetchEvents()
  }
}

async function saveEvent() {
  error.value = ''
  const { error: err } = await supabase
    .from('event_config')
    .update({
      event_name: form.value.event_name,
      event_date: form.value.event_date,
      venue_name: form.value.venue_name,
      max_tickets: form.value.max_tickets,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editingEventId.value)
  if (err) {
    showToast(err.message, false)
  } else {
    showToast('Event updated!', true)
    closeModal()
    await fetchEvents()
  }
}

// Set an event as the active/default event
async function setActiveEvent(eventId) {
  error.value = ''
  // message.value = ''
  // Set all events to inactive, then set the selected one to active
  const { error: err1 } = await supabase
    .from('event_config')
    .update({ is_active: false })
    .eq('is_active', true)
  const { error: err2 } = await supabase
    .from('event_config')
    .update({ is_active: true })
    .eq('id', eventId)
  if (err1 || err2) {
    // error.value = (err1?.message || '') + (err2?.message || '')
    showToast((err1?.message || '') + (err2?.message || ''), false)
  } else {
    // message.value = 'Active event updated!'
    showToast('Active event updated!', true)
    await fetchEvents()
  }
}

onMounted(fetchEvents)
</script>

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-base font-semibold transition-all', toast.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white']" style="transform: translateX(-50%); min-width: 220px;">
      {{ toast.message }}
    </div>
    <div class="max-w-4xl mx-auto">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-700 mb-8">
        <h1 class="text-3xl font-bold text-white mb-4 sm:mb-0 tracking-tight">Event Management</h1>
        <button
          @click="openCreateModal"
          class="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors duration-200"
        >
          + Add Event
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12 text-gray-400">Loading events...</div>

      <!-- Event List -->
      <div v-else>
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">All Events</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="event in events"
              :key="event.id"
              class="bg-[#181f2a] rounded-xl shadow border border-gray-700 p-6 flex flex-col gap-2 hover:border-blue-500 transition relative"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-blue-400 flex items-center gap-2">
                    {{ event.event_name }}
                    <span
                      v-if="event.is_active"
                      class="ml-2 px-2 py-0.5 rounded-full bg-green-600 text-xs text-white font-semibold"
                      title="Active Event"
                    >Active</span>
                  </div>
                  <div class="text-sm text-gray-400">{{ formatDate(event.event_date) }}</div>
                </div>
                <div class="flex gap-2">
                  <button
                    v-if="!event.is_active"
                    @click="setActiveEvent(event.id)"
                    class="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition"
                    title="Set as Active Event"
                  >
                    Set Active
                  </button>
                  <button
                    @click="openEditModal(event)"
                    class="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition"
                    title="Edit Event"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div class="mt-2">
                <div class="text-sm text-gray-300"><span class="font-semibold">Venue:</span> {{ event.venue_name }}</div>
                <div class="text-sm text-gray-300"><span class="font-semibold">Max Tickets:</span> {{ event.max_tickets }}</div>
                <div class="text-xs text-gray-500 mt-2">
                  <span>Created: {{ formatDate(event.created_at) }}</span>
                  <span v-if="event.updated_at"> | Updated: {{ formatDate(event.updated_at) }}</span>
                </div>
              </div>
            </div>
            <div v-if="events.length === 0" class="col-span-full text-center text-gray-500 py-8">
              No events found.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Create/Edit Event -->
    <transition name="fade">
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#232b3b] rounded-xl max-w-md w-full shadow-2xl border border-blue-700 relative" @click.stop>
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 class="text-lg font-semibold text-white">
              {{ isEditing ? 'Edit Event' : 'Add New Event' }}
            </h3>
            <button @click="closeModal" class="text-gray-400 hover:text-red-400 transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Modal Body -->
          <form @submit.prevent="isEditing ? saveEvent() : createEvent()" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Event Name</label>
              <input v-model="form.event_name" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Event Date</label>
              <input v-model="form.event_date" type="date" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Venue Name</label>
              <input v-model="form.venue_name" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Max Tickets</label>
              <input v-model.number="form.max_tickets" type="number" min="1" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
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
              >{{ isEditing ? 'Save Changes' : 'Create Event' }}</button>
            </div>
          </form>
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