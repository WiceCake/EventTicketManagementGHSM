<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '../../lib/supabase'
import { adminService } from '../../lib/adminService'
import { useTheme } from '../../composables/useTheme'
import { useAuth } from '../../composables/useAuth'

const { themeClasses } = useTheme()
const { user } = useAuth()

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
  password: '', // Add password field
})

const toast = ref({ show: false, message: '', success: true })

// Reset password modal state
const showResetModal = ref(false)
const resetUserEmail = ref('')
const resetUserName = ref('')
const resetUserId = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const resetLoading = ref(false)

// Create/Edit user loading state
const createLoading = ref(false)

// Delete user modal state
const showDeleteModal = ref(false)
const deleteUserData = ref({})
const deleteUserEmail = ref('')
const deleteUserName = ref('')
const deleteUserId = ref('')
const deleteLoading = ref(false)
const confirmDeleteEmail = ref('')

function resetForm() {
  form.value = {
    email: '',
    username: '',
    full_name: '',
    role: 'staff',
    is_active: true,
    password: '', // Add password field
  }
  editingUserId.value = null
  createLoading.value = false // Reset loading state
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
    password: '', // Don't populate existing password
  }
  editingUserId.value = user.id
  isEditing.value = true
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

function openResetPasswordModal(user) {
  resetUserEmail.value = user.email
  resetUserName.value = user.username || user.email
  resetUserId.value = user.id
  newPassword.value = ''
  confirmPassword.value = ''
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
  resetUserEmail.value = ''
  resetUserName.value = ''
  resetUserId.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

async function resetUserPassword() {
  // Validation
  if (!newPassword.value || newPassword.value.length < 6) {
    showToast('Password must be at least 6 characters long', false)
    return
  }
  
  if (newPassword.value !== confirmPassword.value) {
    showToast('Passwords do not match', false)
    return
  }
  
  resetLoading.value = true
  
  try {
    // Use admin service to update password
    const response = await adminService.updateUserPassword(resetUserId.value, newPassword.value)
    
    console.log('Password reset successful:', response)
    showToast(`Password reset successfully for ${resetUserName.value}!`, true)
    closeResetModal()
    
  } catch (error) {
    console.error('Reset password error:', error)
    showToast(`Error: ${error.message}`, false)
  } finally {
    resetLoading.value = false
  }
}

function openDeleteModal(userToDelete) {
  // Check if user is trying to delete themselves
  if (user.value && userToDelete.email === user.value.email) {
    showToast('You cannot delete your own account', false)
    return
  }
  
  // Set individual properties
  deleteUserEmail.value = userToDelete.email
  deleteUserName.value = userToDelete.username || userToDelete.full_name
  deleteUserId.value = userToDelete.id
  deleteUserData.value = userToDelete
  confirmDeleteEmail.value = ''
  
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deleteUserData.value = {}
  deleteUserEmail.value = ''
  deleteUserName.value = ''
  deleteUserId.value = ''
  confirmDeleteEmail.value = ''
}

async function deleteUser() {
  deleteLoading.value = true
  
  try {
    // Use the admin service to delete the user
    const response = await adminService.deleteUser(deleteUserData.value.id)
    
    console.log('User deleted successfully:', response)
    showToast(`User ${deleteUserData.value.username || deleteUserData.value.email} deleted successfully!`, true)
    closeDeleteModal()
    await fetchUsers() // Refresh the user list
    
  } catch (error) {
    console.error('Delete user error:', error)
    showToast(`Error: ${error.message}`, false)
  } finally {
    deleteLoading.value = false
  }
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
  createLoading.value = true
  
  try {
    // Use the admin service to create the user
    const response = await adminService.createUser({
      email: form.value.email,
      username: form.value.username,
      password: form.value.password,
      full_name: form.value.full_name,
      role: form.value.role,
    })
    
    console.log('User created successfully:', response)
    showToast('User created successfully!', true)
    closeModal()
    await fetchUsers()
  } catch (error) {
    console.error('Error creating user:', error)
    showToast(`Error: ${error.message}`, false)
  } finally {
    createLoading.value = false
  }
}

async function saveUser() {
  createLoading.value = true
  
  try {
    const response = await adminService.updateUser(editingUserId.value, {
      username: form.value.username,
      full_name: form.value.full_name,
      role: form.value.role,
    })
    
    console.log('User updated successfully:', response)
    showToast('User updated successfully!', true)
    closeModal()
    await fetchUsers()
  } catch (error) {
    console.error('Error updating user:', error)
    showToast(`Error: ${error.message}`, false)
  } finally {
    createLoading.value = false
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
                
                <!-- Action Buttons -->
                <div class="flex gap-2">
                  <button
                    @click="openEditModal(user)"
                    :class="[
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                    ]"
                    title="Edit User"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button
                    @click="openResetPasswordModal(user)"
                    :class="[
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20'
                    ]"
                    title="Reset Password"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  
                  <button
                    @click="openDeleteModal(user)"
                    :class="[
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    ]"
                    title="Delete User"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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
            <div v-if="!isEditing">
              <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Password</label>
              <input 
                v-model="form.password" 
                type="password"
                required 
                minlength="6"
                :class="[
                  'w-full px-3 py-2 border rounded transition-colors duration-200',
                  themeClasses.input,
                  themeClasses.inputBorder,
                  'focus:ring-2 focus:ring-blue-500/30'
                ]" 
                placeholder="Minimum 6 characters"
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
                :disabled="createLoading"
                :class="[
                  'px-4 py-2 rounded transition-colors duration-200 flex items-center justify-center min-w-[120px]',
                  createLoading ? 'opacity-50 cursor-not-allowed' : '',
                  themeClasses.buttonPrimary
                ]"
              >
                <div v-if="createLoading" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ isEditing ? 'Saving...' : 'Creating...' }}
                </div>
                <span v-else>{{ isEditing ? 'Save Changes' : 'Create User' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>

  <!-- Reset Password Modal -->
  <div v-if="showResetModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
    <transition name="fade">
      <div v-if="showResetModal" :class="['w-full max-w-md rounded-xl shadow-2xl border', themeClasses.modal, themeClasses.cardBorder]">
        <!-- Modal Header -->
        <div :class="['flex justify-between items-center p-6 border-b', themeClasses.cardBorder]">
          <h3 :class="['text-xl font-bold', themeClasses.textPrimary]">
            Reset Password
          </h3>
          <button 
            @click="closeResetModal" 
            :class="['transition-colors duration-200 p-1 rounded-lg', themeClasses.textMuted, 'hover:text-red-500', themeClasses.buttonSecondaryHover]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Modal Body -->
        <form @submit.prevent="resetUserPassword()" class="p-6 space-y-4">
          <!-- User info -->
          <div :class="['p-4 rounded-lg border', themeClasses.cardSecondary]">
            <p :class="['text-sm font-medium', themeClasses.textSecondary]">Resetting password for:</p>
            <p :class="['text-lg font-semibold', themeClasses.textPrimary]">{{ resetUserName }}</p>
            <p :class="['text-sm', themeClasses.textMuted]">{{ resetUserEmail }}</p>
          </div>
          
          <div :class="['rounded-lg p-4 border', 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700']">
            <div class="flex">
              <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <p class="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  Admin Action: This will immediately change the user's password.
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <label :class="['block text-sm font-medium mb-1', themeClasses.text]">New Password</label>
            <input 
              v-model="newPassword" 
              type="password" 
              required 
              minlength="6"
              :class="[
                'w-full px-3 py-2 border rounded transition-colors duration-200',
                themeClasses.input,
                themeClasses.inputBorder,
                'focus:ring-2 focus:ring-orange-500/30'
              ]" 
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          
          <div>
            <label :class="['block text-sm font-medium mb-1', themeClasses.text]">Confirm Password</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              required 
              minlength="6"
              :class="[
                'w-full px-3 py-2 border rounded transition-colors duration-200',
                themeClasses.input,
                themeClasses.inputBorder,
                'focus:ring-2 focus:ring-orange-500/30'
              ]" 
              placeholder="Confirm new password"
            />
          </div>
          
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="closeResetModal"
              :disabled="resetLoading"
              :class="[
                'px-4 py-2 rounded transition-colors duration-200',
                themeClasses.buttonSecondary
              ]"
            >Cancel</button>
            <button
              type="submit"
              :disabled="resetLoading"
              :class="[
                'px-4 py-2 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-orange-600 text-white hover:bg-orange-700'
              ]"
            >
              {{ resetLoading ? 'Resetting...' : 'Reset Password' }}
            </button>
          </div>
        </form>
      </div>
    </transition>
  </div>

  <!-- Delete User Modal -->
  <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
    <transition name="fade">
      <div v-if="showDeleteModal" :class="['w-full max-w-md rounded-xl shadow-2xl border relative', themeClasses.modal, themeClasses.cardBorder]">
        <!-- Modal Header -->
        <div :class="['flex justify-between items-center p-6 border-b', themeClasses.cardBorder]">
          <h3 :class="['text-lg font-semibold', themeClasses.textPrimary]">
            Delete User
          </h3>
          <button 
            @click="closeDeleteModal" 
            :class="['transition-colors duration-200', themeClasses.textMuted, 'hover:text-red-500']"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Modal Body -->
        <div class="p-6">
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
            <div class="flex">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"></path>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a3 3 0 003 3h2a3 3 0 003-3V3a2 2 0 012 2v6.5A1.5 1.5 0 0114.5 17h-9A1.5 1.5 0 014 15.5V5zm8 4a1 1 0 10-2 0v3a1 1 0 102 0V9z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <p class="text-sm text-red-800 dark:text-red-200 font-semibold mb-1">
                  Warning: This action cannot be undone!
                </p>
                <p class="text-sm text-red-700 dark:text-red-300">
                  This will permanently delete <strong>{{ deleteUserName || deleteUserEmail || 'this user' }}</strong> from both the authentication system and user database.
                </p>
              </div>
            </div>
          </div>
          
          <p :class="['text-sm mb-4', themeClasses.textSecondary]">
            Type the user's email address to confirm deletion:
          </p>
          
          <input 
            v-model="confirmDeleteEmail" 
            type="email" 
            :class="[
              'w-full px-3 py-2 border rounded transition-colors duration-200 mb-4',
              themeClasses.input,
              themeClasses.inputBorder,
              'focus:ring-2 focus:ring-red-500/30'
            ]" 
            :placeholder="deleteUserEmail || 'Enter user email'"
          />
          
          <div class="flex justify-end gap-2">
            <button
              @click="closeDeleteModal"
              :disabled="deleteLoading"
              :class="[
                'px-4 py-2 rounded transition-colors duration-200',
                themeClasses.buttonSecondary
              ]"
            >Cancel</button>
            <button
              @click="deleteUser"
              :disabled="deleteLoading || !deleteUserEmail || confirmDeleteEmail !== deleteUserEmail"
              :class="[
                'px-4 py-2 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-red-600 text-white hover:bg-red-700'
              ]"
            >
              {{ deleteLoading ? 'Deleting...' : 'Delete User' }}
            </button>
          </div>
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