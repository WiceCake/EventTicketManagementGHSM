<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
    <div class="max-w-md w-full text-center">
      <!-- Maintenance Icon -->
      <div class="mb-8">
        <div class="mx-auto w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
          <svg class="w-12 h-12 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>

      <!-- Title -->
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Under Maintenance
      </h1>

      <!-- Description -->
      <p class="text-lg text-gray-600 dark:text-gray-300 mb-8">
        {{ maintenanceConfig.message }}
      </p>

      <!-- Estimated Time -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
        <div class="flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated completion</span>
        </div>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ maintenanceConfig.estimatedTime }}
        </p>
      </div>

      <!-- Contact Information -->
      <div class="text-sm text-gray-500 dark:text-gray-400">
        <p>For urgent matters, please contact:</p>
        <p class="font-medium mt-1">{{ maintenanceConfig.contactEmail }}</p>
      </div>

      <!-- Admin Access (only show if user is admin) -->
      <div v-if="showAdminAccess" class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="$emit('admin-access')"
          class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Admin Access
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMaintenanceMode } from '../composables/useMaintenanceMode'

// Props
const props = defineProps({
  showAdminAccess: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['admin-access'])

// Get maintenance config
const { maintenanceConfig } = useMaintenanceMode()
</script>

<style scoped>
/* Add any additional styles if needed */
</style>
