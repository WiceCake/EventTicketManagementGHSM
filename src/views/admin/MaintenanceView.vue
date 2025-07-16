<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Maintenance Mode Settings
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Configure and manage the maintenance mode for the application
      </p>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div class="space-y-6">
        <!-- Current Status -->
        <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Current Status
          </h2>
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div 
                :class="[
                  'w-3 h-3 rounded-full',
                  isMaintenanceMode ? 'bg-red-500' : 'bg-green-500'
                ]"
              ></div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ isMaintenanceMode ? 'Maintenance Mode Active' : 'Normal Operation' }}
              </span>
            </div>
            <button
              @click="toggleMaintenanceMode"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                isMaintenanceMode 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              ]"
            >
              {{ isMaintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode' }}
            </button>
          </div>
        </div>

        <!-- Settings Form -->
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Maintenance Settings
          </h2>
          
          <div class="space-y-4">
            <!-- Maintenance Message -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maintenance Message
              </label>
              <textarea
                v-model="settings.message"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter a custom message for users during maintenance..."
              ></textarea>
            </div>

            <!-- Estimated Time -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Completion Time
              </label>
              <input
                v-model="settings.estimatedTime"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., 2 hours, 30 minutes, etc."
              />
            </div>

            <!-- Contact Information -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contact Information
              </label>
              <input
                v-model="settings.contactInfo"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="e.g., support@ghsm.org or (555) 123-4567"
              />
            </div>

            <!-- Save Button -->
            <div class="flex justify-end">
              <button
                @click="saveSettings"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>

        <!-- Warning Section -->
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Important Notice
              </h3>
              <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  When maintenance mode is enabled, all users will see the maintenance page except for administrators who can access the admin panel to manage settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMaintenanceMode } from '../../composables/useMaintenanceMode'

const { 
  isMaintenanceMode, 
  enableMaintenanceMode, 
  disableMaintenanceMode,
  updateMaintenanceSettings,
  getMaintenanceSettings
} = useMaintenanceMode()

const settings = ref({
  message: '',
  estimatedTime: '',
  contactInfo: ''
})

const toggleMaintenanceMode = () => {
  if (isMaintenanceMode.value) {
    disableMaintenanceMode()
  } else {
    enableMaintenanceMode()
  }
}

const saveSettings = () => {
  updateMaintenanceSettings(settings.value)
  // You could add a toast notification here
  console.log('Settings saved:', settings.value)
}

onMounted(() => {
  // Load current settings
  const currentSettings = getMaintenanceSettings()
  if (currentSettings) {
    settings.value = { ...currentSettings }
  }
})
</script>
