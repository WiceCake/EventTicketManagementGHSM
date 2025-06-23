<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../composables/useTheme'

const { themeClasses } = useTheme()

const users = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')

const showModal = ref(false)
const isEditing = ref(false)
const editingUserId = ref(null)
const form = ref({
  email: '',
  username: '',
  full_name: '',
  role: 'staff',
  is_active: true,
})

const toast = ref({ show: false, message: '', success: true })

function resetForm() {
  form.value = {
    email: '',
    username: '',
    full_name: '',
    role: 'staff',
    is_active: true,
  }
  editingUserId.value = null
}

function openCreateModal() {
  resetForm()
  isEditing.value = false
  showModal.value = true
}

function openEditModal(user) {
  form.value = {
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
  }
  editingUserId.value = user.id
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

async function fetchUsers() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else users.value = data
  loading.value = false
}

function showToast(message, success = true) {
  toast.value = { show: true, message, success }
  setTimeout(() => { toast.value.show = false }, 2500)
}

async function createUser() {
  const { error: err } = await supabase
    .from('users')
    .insert({
      email: form.value.email,
      username: form.value.username,
      full_name: form.value.full_name,
      role: form.value.role,
      is_active: form.value.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  if (err) {
    showToast(err.message, false)
  } else {
    showToast('User created!', true)
    closeModal()
    await fetchUsers()
  }
}

async function saveUser() {
  const { error: err } = await supabase
    .from('users')
    .update({
      email: form.value.email,
      username: form.value.username,
      full_name: form.value.full_name,
      role: form.value.role,
      is_active: form.value.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', editingUserId.value)
  if (err) {
    showToast(err.message, false)
  } else {
    showToast('User updated!', true)
    closeModal()
    await fetchUsers()
  }
}

onMounted(fetchUsers)
</script>

<template>  <div :class="['min-h-screen py-8 px-4', themeClasses.pageBackground]">
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
          <h1 :class="['text-3xl font-bold tracking-tight', themeClasses.textPrimary]">User Management</h1>
          <p :class="['mt-2 text-lg', themeClasses.textMuted]">Manage system users and their permissions</p>
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
          Add User
        </button>
      </div>      <!-- Loading State -->
      <div v-if="loading" class="text-center py-16">
        <div :class="['inline-block w-8 h-8 border-4 border-current border-r-transparent rounded-full animate-spin', themeClasses.textMuted]"></div>
        <p :class="['mt-4 text-lg font-medium', themeClasses.textMuted]">Loading users...</p>
      </div>

      <!-- User List -->
      <div v-else>
        <div class="space-y-6">
          <h2 :class="['text-2xl font-semibold', themeClasses.textPrimary]">All Users</h2>
          
          <!-- User Cards Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div
              v-for="user in users"
              :key="user.id"
              :class="[
                'group rounded-xl shadow-lg border p-6 space-y-4 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1',
                themeClasses.card,
                themeClasses.cardBorder
              ]"
            >
              <!-- User Header -->
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div :class="[
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                    user.is_active 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-400 text-gray-100'
                  ]">
                    {{ (user.username || user.email)[0].toUpperCase() }}
                  </div>
                  <div>
                    <h3 :class="['text-lg font-bold', themeClasses.textPrimary]">
                      {{ user.username || user.email }}
                    </h3>
                    <p :class="['text-sm', themeClasses.textMuted]">{{ user.email }}</p>
                  </div>
                </div>
                
                <!-- Action Button -->
                <button
                  @click="openEditModal(user)"
                  :class="[
                    'opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg',
                    themeClasses.hover
                  ]"
                  title="Edit User"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>

              <!-- User Details -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span :class="['text-sm font-medium', themeClasses.textSecondary]">Full Name:</span>
                  <span :class="['text-sm', themeClasses.textPrimary]">{{ user.full_name || '—' }}</span>
                </div>
                
                <div class="flex items-center justify-between">
                  <span :class="['text-sm font-medium', themeClasses.textSecondary]">Role:</span>
                  <span
                    :class="[
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                      user.role === 'admin' 
                        ? themeClasses.badgeDanger
                        : user.role === 'staff'
                        ? themeClasses.badgeWarning
                        : themeClasses.badgePrimary
                    ]"
                  >
                    {{ user.role }}
                  </span>
                </div>
                
                <div class="flex items-center justify-between">
                  <span :class="['text-sm font-medium', themeClasses.textSecondary]">Status:</span>
                  <span
                    :class="[
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                      user.is_active ? themeClasses.badgeSuccess : themeClasses.badgeDanger
                    ]"
                  >
                    {{ user.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>

              <!-- Timestamps -->
              <div :class="['pt-4 border-t text-xs space-y-1', themeClasses.cardBorder, themeClasses.textMuted]">
                <div>Created: {{ formatDate(user.created_at) }}</div>
                <div v-if="user.updated_at">Updated: {{ formatDate(user.updated_at) }}</div>
              </div>
            </div>
          </div>
          
          <!-- Empty State -->
          <div v-if="users.length === 0" class="text-center py-16">
            <svg :class="['w-16 h-16 mx-auto mb-6 opacity-50', themeClasses.textMuted]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 :class="['text-xl font-semibold mb-2', themeClasses.textPrimary]">No Users Found</h3>
            <p :class="['max-w-md mx-auto', themeClasses.textMuted]">
              Get started by adding your first user to the system.
            </p>
          </div>
        </div>
      </div>
    </div><!-- Modal for Create/Edit User -->
    <transition name="fade">
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div 
          :class="[
            'rounded-xl max-w-md w-full shadow-2xl border relative',
            themeClasses.modal,
            themeClasses.cardBorder
          ]" 
          @click.stop
        >
          <!-- Modal Header -->
          <div :class="['flex items-center justify-between p-6 border-b', themeClasses.cardBorder]">
            <h3 :class="['text-lg font-semibold', themeClasses.textPrimary]">
              {{ isEditing ? 'Edit User' : 'Add New User' }}
            </h3>
            <button 
              @click="closeModal" 
              :class="['transition-colors duration-200', themeClasses.textMuted, 'hover:text-red-500']"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Modal Body -->
          <form @submit.prevent="isEditing ? saveUser() : createUser()" class="p-6 space-y-4">
            <div>
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Email</label>
              <input 
                v-model="form.email" 
                type="email" 
                required 
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder,
                  'focus:ring-2 focus:ring-blue-500/30'
                ]" 
              />
            </div>
            <div>
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Username</label>
              <input 
                v-model="form.username" 
                required 
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder,
                  'focus:ring-2 focus:ring-blue-500/30'
                ]" 
              />
            </div>
            <div>
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Full Name</label>
              <input 
                v-model="form.full_name" 
                required 
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder,
                  'focus:ring-2 focus:ring-blue-500/30'
                ]" 
              />
            </div>
            <div>
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Role</label>
              <select 
                v-model="form.role" 
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder
                ]"
              >
                <option value="admin">admin</option>
                <option value="staff">staff</option>
              </select>
            </div>
            <div>
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Active</label>
              <select 
                v-model="form.is_active" 
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder
                ]"
              >
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="closeModal"
                :class="[
                  'px-4 py-2 rounded transition-colors duration-200',
                  themeClasses.buttonSecondary
                ]"
              >Cancel</button>
              <button
                type="submit"
                :class="[
                  'px-4 py-2 rounded transition-colors duration-200',
                  themeClasses.buttonPrimary
                ]"
              >{{ isEditing ? 'Save Changes' : 'Create User' }}</button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>