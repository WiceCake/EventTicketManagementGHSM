<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

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

<template>
  <div class="event-bg min-h-screen py-10 px-2">
    <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-base font-semibold transition-all', toast.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white']" style="transform: translateX(-50%); min-width: 220px;">
      {{ toast.message }}
    </div>
    <div class="max-w-5xl mx-auto">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-700 mb-8">
        <h1 class="text-3xl font-bold text-white mb-4 sm:mb-0 tracking-tight">User Management</h1>
        <button
          @click="openCreateModal"
          class="inline-flex items-center px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors duration-200"
        >
          + Add User
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12 text-gray-400">Loading users...</div>

      <!-- User List -->
      <div v-else>
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">All Users</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="user in users"
              :key="user.id"
              class="bg-[#181f2a] rounded-xl shadow border border-gray-700 p-6 flex flex-col gap-2 hover:border-blue-500 transition relative"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-blue-400 flex items-center gap-2">
                    {{ user.username || user.email }}
                    <span
                      v-if="user.is_active"
                      class="ml-2 px-2 py-0.5 rounded-full bg-green-600 text-xs text-white font-semibold"
                      title="Active User"
                    >Active</span>
                    <span
                      v-else
                      class="ml-2 px-2 py-0.5 rounded-full bg-gray-600 text-xs text-white font-semibold"
                      title="Inactive User"
                    >Inactive</span>
                  </div>
                  <div class="text-sm text-gray-400">{{ user.email }}</div>
                </div>
                <div class="flex gap-2">
                  <span
                    class="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded"
                    :class="{
                      'bg-blue-500': user.role === 'admin',
                      'bg-purple-500': user.role === 'staff',
                      'bg-gray-500': user.role !== 'admin' && user.role !== 'staff'
                    }"
                  >
                    {{ user.role }}
                  </span>
                  <button
                    @click="openEditModal(user)"
                    class="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition"
                    title="Edit User"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div class="mt-2">
                <div class="text-sm text-gray-300"><span class="font-semibold">Full Name:</span> {{ user.full_name }}</div>
                <div class="text-xs text-gray-500 mt-2">
                  <span>Created: {{ formatDate(user.created_at) }}</span>
                  <span v-if="user.updated_at"> | Updated: {{ formatDate(user.updated_at) }}</span>
                </div>
              </div>
            </div>
            <div v-if="users.length === 0" class="col-span-full text-center text-gray-500 py-8">
              No users found.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Create/Edit User -->
    <transition name="fade">
      <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#232b3b] rounded-xl max-w-md w-full shadow-2xl border border-blue-700 relative" @click.stop>
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 class="text-lg font-semibold text-white">
              {{ isEditing ? 'Edit User' : 'Add New User' }}
            </h3>
            <button @click="closeModal" class="text-gray-400 hover:text-red-400 transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Modal Body -->
          <form @submit.prevent="isEditing ? saveUser() : createUser()" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input v-model="form.email" type="email" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input v-model="form.username" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
              <input v-model="form.full_name" required class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white focus:ring focus:ring-blue-400/30" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <select v-model="form.role" class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white">
                <option value="admin">admin</option>
                <option value="staff">staff</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Active</label>
              <select v-model="form.is_active" class="w-full px-3 py-2 border border-gray-700 rounded bg-[#181f2a] text-white">
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
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
              >{{ isEditing ? 'Save Changes' : 'Create User' }}</button>
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