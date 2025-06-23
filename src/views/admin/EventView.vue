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
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 :class="[themeClasses.textPrimary, 'text-3xl font-bold tracking-tight']">Event Management</h1>
          <p :class="[themeClasses.textMuted, 'mt-2 text-lg']">Manage events and their configurations</p>
        </div>
        <button
          @click="openCreateModal"
          :class="[
            'mt-4 sm:mt-0 inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5',
            themeClasses.buttonPrimary
          ]"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Event
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div :class="['inline-block w-8 h-8 border-4 border-current border-r-transparent rounded-full animate-spin', themeClasses.textMuted]"></div>
        <p :class="['mt-4 text-lg font-medium', themeClasses.textMuted]">Loading events...</p>
      </div>

      <!-- Event List -->
      <div v-else>
        <div class="space-y-6">
          <h2 :class="[themeClasses.textPrimary, 'text-2xl font-semibold']">All Events</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div
                v-for="event in events"
                :key="event.id"
                :class="[
                  themeClasses.card, 
                  themeClasses.cardBorder,
                  themeClasses.cardHover, 
                  'rounded-xl shadow-md border p-6 space-y-4 transition-all hover:shadow-lg'
                ]"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <h3 :class="[themeClasses.textPrimary, 'text-lg font-semibold truncate']">
                      {{ event.event_name }}
                    </h3>
                    <p :class="[themeClasses.textMuted, 'text-sm mt-1']">
                      {{ formatDate(event.event_date) }}
                    </p>
                  </div>
                  
                  <div class="flex items-center gap-2 ml-3">
                    <!-- Status Badge -->
                    <span
                      v-if="event.is_finished"
                      :class="[themeClasses.badgeSecondary, 'px-2 py-1 rounded-full text-xs font-medium']"
                    >
                      Finished
                    </span>
                    <span
                      v-else-if="event.is_active"
                      :class="[themeClasses.badgeSuccess, 'px-2 py-1 rounded-full text-xs font-medium']"
                    >
                      Active
                    </span>
                    
                    <!-- Actions -->
                    <div v-if="event.is_active && !event.is_finished" class="relative">
                      <button 
                        @click.stop="toggleMenu(event.id)" 
                        :class="[
                          'p-2 rounded-full transition-colors',
                          themeClasses.buttonSecondary
                        ]" 
                        title="More Options"
                      >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="19" cy="12" r="2"/>
                        </svg>
                      </button>
                      
                      <div
                        v-if="openMenuId === event.id"
                        @click.stop
                        :class="[
                          'absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-20 border overflow-hidden',
                          themeClasses.card,
                          themeClasses.cardBorder
                        ]"
                      >
                        <button
                          @click="finishEvent(event.id); closeMenu()"
                          :class="[
                            'w-full text-left px-4 py-3 text-sm transition-colors',
                            themeClasses.menuItem
                          ]"
                        >
                          Finish Event
                        </button>
                        <button
                          @click="openEditModal(event); closeMenu()"
                          :class="[
                            'w-full text-left px-4 py-3 text-sm transition-colors',
                            themeClasses.menuItem
                          ]"
                        >
                          Edit Event
                        </button>
                      </div>
                    </div>
                    
                    <!-- Set Active button for inactive events -->
                    <button
                      v-if="!event.is_active && !event.is_finished"
                      @click="setActiveEvent(event.id)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded-md transition-all',
                        themeClasses.buttonSuccess
                      ]"
                      title="Set as Active Event"
                    >
                      Set Active
                    </button>
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div :class="[themeClasses.textSecondary, 'text-sm']">
                    <span class="font-medium">Venue:</span> {{ event.venue_name }}
                  </div>
                  <div :class="[themeClasses.textSecondary, 'text-sm']">
                    <span class="font-medium">Max Tickets:</span> {{ event.max_tickets }}
                  </div>
                  <div :class="[themeClasses.textMuted, 'text-xs border-t pt-2 mt-3']" :style="`border-color: ${themeClasses.cardBorder.split(' ').pop()}`">
                    <span>Created: {{ formatDate(event.created_at) }}</span>
                    <span v-if="event.updated_at"> • Updated: {{ formatDate(event.updated_at) }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Empty State -->
              <div v-if="events.length === 0" class="col-span-full text-center py-16">
                <svg :class="[themeClasses.textMuted, 'w-16 h-16 mx-auto mb-4 opacity-50']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a4 4 0 118 0v4m-4 6v-3a1 1 0 00-1-1H7a1 1 0 00-1 1v3m8 0V10a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m8 0h-8"></path>                </svg>
                <h3 :class="[themeClasses.textPrimary, 'text-lg font-medium mb-2']">No events found</h3>
                <p :class="[themeClasses.textMuted, 'text-sm']">Get started by creating your first event</p>
              </div>
            </div>
          </div>
        </div>
    </div><!-- Modal for Create/Edit Event -->
    <transition name="fade">
      <div v-if="showModal" :class="[themeClasses.overlay, 'fixed inset-0 flex items-center justify-center z-50 p-4']">
        <div :class="[themeClasses.card, themeClasses.cardBorder, 'rounded-xl max-w-md w-full shadow-2xl relative']" @click.stop>
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b', themeClasses.cardBorder]">
            <h3 :class="[themeClasses.textPrimary, 'text-lg font-semibold']">
              {{ isEditing ? 'Edit Event' : 'Add New Event' }}
            </h3>
            <button @click="closeModal" :class="[themeClasses.textMuted, 'hover:text-red-500 transition-colors']">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Modal Body -->
          <form @submit.prevent="isEditing ? saveEvent() : createEvent()" class="p-6 space-y-4">
            <div>
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">Event Name</label>
              <input 
                v-model="form.event_name" 
                required 
                :class="[
                  themeClasses.input, 
                  'w-full px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
                ]" 
                placeholder="Enter event name"
              />
            </div>
            <div>
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">Event Date</label>
              <input 
                v-model="form.event_date" 
                type="date" 
                required 
                :class="[
                  themeClasses.input, 
                  'w-full px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
                ]" 
              />
            </div>
            <div>
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">Venue Name</label>
              <input 
                v-model="form.venue_name" 
                required 
                :class="[
                  themeClasses.input, 
                  'w-full px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
                ]" 
                placeholder="Enter venue name"
              />
            </div>
            <div>
              <label :class="[themeClasses.textSecondary, 'block text-sm font-medium mb-2']">Max Tickets</label>
              <input 
                v-model.number="form.max_tickets" 
                type="number" 
                min="1" 
                required 
                :class="[
                  themeClasses.input, 
                  'w-full px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
                ]" 
                placeholder="Enter maximum number of tickets"
              />
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button
                type="button"
                @click="closeModal"
                :class="[
                  themeClasses.buttonSecondary, 
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm'
                ]"
              >
                Cancel
              </button>
              <button
                type="submit"
                :class="[
                  themeClasses.buttonPrimary, 
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm'
                ]"
              >
                {{ isEditing ? 'Save Changes' : 'Create Event' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../composables/useTheme'

const { themeClasses } = useTheme()

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

const openMenuId = ref(null)
function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}
function closeMenu() {
  openMenuId.value = null
}
window.addEventListener('click', closeMenu)
function stopMenuClick(e) {
  e.stopPropagation()
}

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
      max_tickets: form.value.max_tickets,      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: false,
      is_finished: false,
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
  
  // Check if the event is finished
  const { data: eventData, error: checkErr } = await supabase
    .from('event_config')
    .select('is_finished')
    .eq('id', eventId)
    .single()
    
  if (checkErr || eventData?.is_finished) {
    showToast('Cannot set a finished event as active.', false)
    return
  }
  
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
    showToast((err1?.message || '') + (err2?.message || ''), false)
  } else {
    showToast('Active event updated!', true)
    await fetchEvents()
  }
}

async function finishEvent(eventId) {
  const { error: err } = await supabase
    .from('event_config')
    .update({ 
      is_active: false,
      is_finished: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', eventId)
  if (err) {
    showToast('Failed to finish event: ' + err.message, false)
  } else {
    showToast('Event marked as finished!', true)
    await fetchEvents()
  }
}

onMounted(fetchEvents)
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>