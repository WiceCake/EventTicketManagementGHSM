import { ref, computed, watch, onMounted } from 'vue'

// Available themes
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
}

// Theme state
const currentTheme = ref(THEMES.SYSTEM)
const systemPrefersDark = ref(false)

// Computed actual theme (resolves system preference)
const resolvedTheme = computed(() => {
  if (currentTheme.value === THEMES.SYSTEM) {
    return systemPrefersDark.value ? THEMES.DARK : THEMES.LIGHT
  }
  return currentTheme.value
})

// Theme classes for different components
const themeClasses = computed(() => {
  const isDark = resolvedTheme.value === THEMES.DARK
  
  return {
    // Background gradients
    pageBackground: isDark 
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800' 
      : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100',
    
    background: isDark 
      ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800' 
      : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100',
    
    // Card backgrounds
    cardBackground: isDark 
      ? 'bg-slate-800/90 border-slate-700' 
      : 'bg-white/90 border-slate-200',
    
    card: isDark 
      ? 'bg-slate-800/90 border-slate-700' 
      : 'bg-white/90 border-slate-200',
      // Secondary card backgrounds
    cardSecondary: isDark 
      ? 'bg-slate-700/50 border-slate-600' 
      : 'bg-slate-50/80 border-slate-300',
    
    // Camera container backgrounds
    cameraActive: isDark
      ? 'bg-gradient-to-br from-slate-800 to-slate-700 border-blue-500'
      : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-500',
    
    cameraInactive: isDark
      ? 'bg-gradient-to-br from-slate-700 to-slate-600 border-slate-600'
      : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300',
    
    // Borders
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    cardBorder: isDark ? 'border-slate-700' : 'border-slate-200',
    
    // Sidebar
    sidebarBackground: isDark 
      ? 'bg-slate-900/95 border-slate-700' 
      : 'bg-white/95 border-slate-200',
      // Text colors
    textPrimary: isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    muted: isDark ? 'text-slate-400' : 'text-slate-500',    // Icon colors (more visible in dark mode)
    iconPrimary: isDark ? 'text-white/80' : 'text-slate-600',
    iconSecondary: isDark ? 'text-white/60' : 'text-slate-500',
    
    // Hover effects
    hover: isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50',
    
    // Interactive elements
    buttonPrimary: isDark 
      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    
    buttonSecondary: isDark 
      ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600' 
      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300',      // Input fields
    input: isDark 
      ? 'bg-slate-800/90 border-2 border-slate-600 text-slate-100 focus:border-blue-500 focus:ring-blue-500/50 shadow-lg backdrop-blur-sm' 
      : 'bg-white border-2 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500/30 shadow-lg',
    
    // Select fields (dropdown)
    select: isDark 
      ? 'bg-slate-800/90 border-2 border-slate-600 text-slate-100 focus:border-blue-500 focus:ring-blue-500/50 shadow-lg backdrop-blur-sm appearance-none bg-no-repeat bg-right bg-center' 
      : 'bg-white border-2 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500/30 shadow-lg appearance-none bg-no-repeat bg-right bg-center',
    
    inputBorder: isDark ? 'border-slate-600' : 'border-slate-300',
    
    // Card interactions
    cardHover: isDark ? 'hover:border-blue-500' : 'hover:border-blue-400',
    
    // Status colors
    statusSuccess: isDark 
      ? 'bg-emerald-900 text-emerald-200 border-emerald-700' 
      : 'bg-emerald-100 text-emerald-800 border-emerald-300',
    
    statusWarning: isDark 
      ? 'bg-amber-900 text-amber-200 border-amber-700' 
      : 'bg-amber-100 text-amber-800 border-amber-300',
    
    statusError: isDark 
      ? 'bg-red-900 text-red-200 border-red-700' 
      : 'bg-red-100 text-red-800 border-red-300',
    
    statusInfo: isDark 
      ? 'bg-blue-900 text-blue-200 border-blue-700' 
      : 'bg-blue-100 text-blue-800 border-blue-300',
    
    // Tables
    tableHeader: isDark 
      ? 'bg-slate-800 text-slate-300 border-slate-700' 
      : 'bg-slate-50 text-slate-700 border-slate-200',
    
    tableRow: isDark 
      ? 'border-slate-700 hover:bg-slate-800/50' 
      : 'border-slate-200 hover:bg-slate-50',
    
    // Navigation
    navItem: isDark 
      ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    
    navItemActive: isDark 
      ? 'text-white bg-blue-600' 
      : 'text-blue-700 bg-blue-100',
      // Modal/overlay
    overlay: 'bg-black/60',
    modal: isDark 
      ? 'bg-slate-800 border-slate-700' 
      : 'bg-white border-slate-200',
    
    // Toast notifications
    toastSuccess: isDark 
      ? 'bg-green-600 text-white border-green-500' 
      : 'bg-green-600 text-white border-green-500',
    
    toastError: isDark 
      ? 'bg-red-600 text-white border-red-500' 
      : 'bg-red-600 text-white border-red-500',
    
    // Pagination
    paginationButton: isDark 
      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    
    paginationButtonDisabled: isDark 
      ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
      : 'bg-slate-300 text-slate-500 cursor-not-allowed',
    
    // Badge variants
    badgePrimary: isDark 
      ? 'bg-blue-900 text-blue-200 border-blue-700' 
      : 'bg-blue-100 text-blue-800 border-blue-300',
    
    badgeSuccess: isDark 
      ? 'bg-green-900 text-green-200 border-green-700' 
      : 'bg-green-100 text-green-800 border-green-300',
    
    badgeWarning: isDark 
      ? 'bg-yellow-900 text-yellow-200 border-yellow-700' 
      : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      badgeDanger: isDark 
      ? 'bg-red-900 text-red-200 border-red-700' 
      : 'bg-red-100 text-red-800 border-red-300',
    
    badgeSecondary: isDark 
      ? 'bg-slate-700 text-slate-300 border-slate-600' 
      : 'bg-slate-200 text-slate-700 border-slate-300',
    
    // Menu items
    menuItem: isDark 
      ? 'hover:bg-slate-700 text-slate-300 hover:text-white' 
      : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900',
    
    // Action buttons
    buttonSuccess: isDark 
      ? 'bg-green-600 hover:bg-green-700 text-white' 
      : 'bg-green-600 hover:bg-green-700 text-white',
    
    buttonDanger: isDark 
      ? 'bg-red-600 hover:bg-red-700 text-white' 
      : 'bg-red-600 hover:bg-red-700 text-white',
    
    buttonGhost: isDark 
      ? 'bg-transparent hover:bg-slate-700 text-slate-300 border-slate-600' 
      : 'bg-transparent hover:bg-slate-50 text-slate-600 border-slate-300',
  }
})

// Theme icons
const themeIcons = {
  [THEMES.LIGHT]: '☀️',
  [THEMES.DARK]: '🌙',
  [THEMES.SYSTEM]: '💻'
}

// Load theme from localStorage
function loadTheme() {
  const saved = localStorage.getItem('theme')
  if (saved && Object.values(THEMES).includes(saved)) {
    currentTheme.value = saved
  }
}

// Save theme to localStorage
function saveTheme(theme) {
  localStorage.setItem('theme', theme)
  currentTheme.value = theme
}

// Check system preference
function checkSystemPreference() {
  systemPrefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply theme to document
function applyTheme() {
  const isDark = resolvedTheme.value === THEMES.DARK
  
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  
  // Update meta theme color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#1e293b' : '#ffffff')
  }
}

// Theme composable
export function useTheme() {
  // Initialize theme system
  const initTheme = () => {
    loadTheme()
    checkSystemPreference()
    applyTheme()
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkSystemPreference)
    
    // Watch for theme changes
    watch(resolvedTheme, applyTheme, { immediate: true })
    
    return () => {
      mediaQuery.removeEventListener('change', checkSystemPreference)
    }
  }
  
  // Set theme
  const setTheme = (theme) => {
    if (Object.values(THEMES).includes(theme)) {
      saveTheme(theme)
    }
  }
  
  // Toggle between light and dark (skip system)
  const toggleTheme = () => {
    const newTheme = resolvedTheme.value === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    setTheme(newTheme)
  }
  
  return {
    // State
    currentTheme: computed(() => currentTheme.value),
    resolvedTheme,
    systemPrefersDark: computed(() => systemPrefersDark.value),
    
    // Theme data
    themes: THEMES,
    themeClasses,
    themeIcons,
    
    // Methods
    initTheme,
    setTheme,
    toggleTheme,
    
    // Utilities
    isDark: computed(() => resolvedTheme.value === THEMES.DARK),
    isLight: computed(() => resolvedTheme.value === THEMES.LIGHT),
  }
}
