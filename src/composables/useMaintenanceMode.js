import { ref, computed } from 'vue'

// 🔧 MAINTENANCE MODE CONFIGURATION
// To disable maintenance mode, change this to false
// To enable maintenance mode, change this to true
const DEFAULT_MAINTENANCE_MODE = true

// Global maintenance mode state
const isMaintenanceMode = ref(DEFAULT_MAINTENANCE_MODE) // Default to maintenance mode
const isAdminAccessGranted = ref(false)
const maintenanceConfig = ref({
  estimatedTime: '2 hours',
  message: 'We\'re currently performing scheduled maintenance to improve your experience.',
  contactEmail: 'support@ghsm.edu',
  allowAdminAccess: true
})

// Check if maintenance mode should be enabled based on localStorage or API
const initializeMaintenanceMode = () => {
  // Start with default configuration
  isMaintenanceMode.value = DEFAULT_MAINTENANCE_MODE
  
  // Check localStorage for maintenance mode setting
  const stored = localStorage.getItem('maintenanceMode')
  const adminAccess = localStorage.getItem('adminAccessGranted')
  
  if (stored) {
    try {
      const config = JSON.parse(stored)
      // Only override default if explicitly stored
      if (config.enabled !== undefined) {
        isMaintenanceMode.value = config.enabled
      }
      if (config.estimatedTime) maintenanceConfig.value.estimatedTime = config.estimatedTime
      if (config.message) maintenanceConfig.value.message = config.message
      if (config.contactEmail) maintenanceConfig.value.contactEmail = config.contactEmail
      if (config.allowAdminAccess !== undefined) maintenanceConfig.value.allowAdminAccess = config.allowAdminAccess
    } catch (e) {
      console.error('Error parsing maintenance mode config:', e)
    }
  }
  
  if (adminAccess) {
    isAdminAccessGranted.value = JSON.parse(adminAccess)
  }
}

// Enable maintenance mode
const enableMaintenanceMode = (config = {}) => {
  isMaintenanceMode.value = true
  
  // Update config if provided
  if (config.estimatedTime) maintenanceConfig.value.estimatedTime = config.estimatedTime
  if (config.message) maintenanceConfig.value.message = config.message
  if (config.contactEmail) maintenanceConfig.value.contactEmail = config.contactEmail
  if (config.allowAdminAccess !== undefined) maintenanceConfig.value.allowAdminAccess = config.allowAdminAccess
  
  // Save to localStorage
  localStorage.setItem('maintenanceMode', JSON.stringify({
    enabled: true,
    ...maintenanceConfig.value
  }))
}

// Disable maintenance mode
const disableMaintenanceMode = () => {
  isMaintenanceMode.value = false
  localStorage.setItem('maintenanceMode', JSON.stringify({
    enabled: false,
    ...maintenanceConfig.value
  }))
}

// Grant admin access during maintenance
const grantAdminAccess = () => {
  isAdminAccessGranted.value = true
  localStorage.setItem('adminAccessGranted', 'true')
}

// Revoke admin access
const revokeAdminAccess = () => {
  isAdminAccessGranted.value = false
  localStorage.setItem('adminAccessGranted', 'false')
}

// Update maintenance settings
const updateMaintenanceSettings = (newSettings) => {
  if (newSettings.estimatedTime) maintenanceConfig.value.estimatedTime = newSettings.estimatedTime
  if (newSettings.message) maintenanceConfig.value.message = newSettings.message
  if (newSettings.contactInfo) maintenanceConfig.value.contactEmail = newSettings.contactInfo
  
  // Save to localStorage
  localStorage.setItem('maintenanceMode', JSON.stringify({
    enabled: isMaintenanceMode.value,
    ...maintenanceConfig.value
  }))
}

// Get current maintenance settings
const getMaintenanceSettings = () => {
  return {
    estimatedTime: maintenanceConfig.value.estimatedTime,
    message: maintenanceConfig.value.message,
    contactInfo: maintenanceConfig.value.contactEmail
  }
}

// Check if current user should have admin access during maintenance
const hasAdminAccess = computed(() => {
  // You can implement more sophisticated admin detection here
  // For now, we'll check if user has admin role stored
  const userRole = localStorage.getItem('userRole')
  return userRole === 'admin' && maintenanceConfig.value.allowAdminAccess
})

// Composable hook
export function useMaintenanceMode() {
  return {
    isMaintenanceMode,
    isAdminAccessGranted,
    maintenanceConfig,
    hasAdminAccess,
    enableMaintenanceMode,
    disableMaintenanceMode,
    initializeMaintenanceMode,
    grantAdminAccess,
    revokeAdminAccess,
    updateMaintenanceSettings,
    getMaintenanceSettings
  }
}
