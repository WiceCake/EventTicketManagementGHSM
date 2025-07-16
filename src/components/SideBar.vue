<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTheme } from '../composables/useTheme'
import ThemeSelector from './ThemeSelector.vue'
import {
  HomeIcon,
  TicketIcon,
  QrCodeIcon,
  UsersIcon,
  ChartBarIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon
} from '@heroicons/vue/24/outline'

// Props and emits
defineEmits(['toggleSidebar'])

// Composables
const router = useRouter()
const route = useRoute()
const { user, signOut, userProfile } = useAuth()
const { themeClasses, isDark } = useTheme()

// Injected state
const sidebarCollapsed = inject('sidebarCollapsed', ref(false))
const isMobile = inject('isMobile', ref(false))

// Navigation items (available to all authenticated users)
const navigationItems = computed(() => {
  const baseItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: HomeIcon,
      exact: true
    }
  ]
  
  // Add tickets for admin and staff
  if (userProfile.value?.role === 'admin' || userProfile.value?.role === 'staff') {
    baseItems.push({
      name: 'Tickets',
      path: '/admin/ticket',
      icon: TicketIcon
    })
  }
  
  // Add QR Scanner and History for all users
  baseItems.push(
    {
      name: 'QR Scanner',
      path: '/qrcode',
      icon: QrCodeIcon
    },
    {
      name: 'Scan History',
      path: '/qrcode/history',
      icon: ClockIcon
    }
  )
  
  return baseItems
})

// Admin items (only shown for admin users)
const adminItems = computed(() => {
  if (userProfile.value?.role !== 'admin') return []
  
  return [
    {
      name: 'Users',
      path: '/admin/user',
      icon: UsersIcon
    },
    {
      name: 'Events',
      path: '/admin/events',
      icon: CalendarDaysIcon
    },
    {
      name: 'Reports',
      path: '/admin/reports',
      icon: ChartBarIcon
    },
    {
      name: 'Maintenance',
      path: '/admin/maintenance',
      icon: WrenchScrewdriverIcon
    }
  ]
})

// Check if route is active
const isActiveRoute = (itemPath, exact = false) => {
  if (exact) {
    return route.path === itemPath
  }
  
  // Special handling for specific routes to avoid conflicts
  if (itemPath === '/qrcode' && route.path === '/qrcode/history') {
    return false // Don't highlight /qrcode when on /qrcode/history
  }
  
  if (itemPath === '/qrcode/history' && route.path === '/qrcode/history') {
    return true // Exact match for history
  }
  
  // For non-exact matches, check if current path matches exactly
  if (route.path === itemPath) {
    return true
  }
  
  // Only match if it's a true sub-path (has a trailing slash) and not root
  return route.path.startsWith(itemPath + '/') && itemPath !== '/'
}

// Handle logout
const handleLogout = async () => {
  try {
    await signOut()
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}

// User display name
const displayName = computed(() => {
  return userProfile.value?.full_name || userProfile.value?.username || user.value?.email || 'User'
})

// User initials for avatar
const userInitials = computed(() => {
  const name = displayName.value
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
})
</script>

<template>
  <div
    :class="[
      'fixed left-0 top-0 h-full transition-all duration-300 ease-in-out z-30 flex flex-col',
      themeClasses.sidebarBackground,
      'border-r backdrop-blur-sm',
      sidebarCollapsed ? 'w-20' : 'w-64',
      isMobile && sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b" :class="themeClasses.cardBorder">
      <div v-if="!sidebarCollapsed" class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">GH</span>
        </div>
        <div>
          <h1 :class="['font-bold text-lg', themeClasses.textPrimary]">GHSM</h1>
          <p :class="['text-xs', themeClasses.textMuted]">Event Management</p>
        </div>
      </div>
      
      <div v-else class="flex justify-center w-full">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">GH</span>
        </div>
      </div>
    </div>    <!-- Navigation -->
    <nav class="flex-1 px-3 py-6 space-y-1">
      <!-- Main Navigation -->
      <div class="space-y-1">
        <div v-if="!sidebarCollapsed" :class="['px-3 py-2 text-xs font-semibold uppercase tracking-wider', themeClasses.textMuted]">
          Navigation
        </div>        <router-link
          v-for="item in navigationItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'group flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative',
            sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2',
            isActiveRoute(item.path, item.exact) 
              ? themeClasses.navItemActive 
              : themeClasses.navItem
          ]"
        >
          <component 
            :is="item.icon" 
            class="w-5 h-5 flex-shrink-0"
          />
          <span v-if="!sidebarCollapsed" class="truncate">{{ item.name }}</span>
          
          <!-- Tooltip for collapsed state -->
          <div
            v-if="sidebarCollapsed"
            :class="[
              'absolute left-full ml-3 px-3 py-2 rounded-lg text-sm font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border backdrop-blur-sm',
              themeClasses.card,
              themeClasses.text,
              themeClasses.cardBorder
            ]"
            style="transform: translateY(-50%); top: 50%;"
          >
            {{ item.name }}
            <!-- Arrow pointer -->
            <div 
              :class="[
                'absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-r-8 border-t-4 border-b-4 border-t-transparent border-b-transparent',
                isDark ? 'border-r-slate-800' : 'border-r-white'
              ]"
            ></div>
          </div>
        </router-link>
      </div>

      <!-- Admin Section -->
      <div v-if="adminItems.length > 0" class="pt-6 space-y-1">
        <div v-if="!sidebarCollapsed" :class="['px-3 py-2 text-xs font-semibold uppercase tracking-wider', themeClasses.textMuted]">
          Administration
        </div>
        <div v-else class="border-t my-4" :class="themeClasses.cardBorder"></div>        <router-link
          v-for="item in adminItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'group flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative',
            sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2',
            isActiveRoute(item.path) 
              ? themeClasses.navItemActive 
              : themeClasses.navItem
          ]"
        >
          <component 
            :is="item.icon" 
            class="w-5 h-5 flex-shrink-0"
          />
          <span v-if="!sidebarCollapsed" class="truncate">{{ item.name }}</span>
          
          <!-- Tooltip for collapsed state -->
          <div
            v-if="sidebarCollapsed"
            :class="[
              'absolute left-full ml-3 px-3 py-2 rounded-lg text-sm font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border backdrop-blur-sm',
              themeClasses.card,
              themeClasses.text,
              themeClasses.cardBorder
            ]"
            style="transform: translateY(-50%); top: 50%;"
          >
            {{ item.name }}
            <!-- Arrow pointer -->
            <div 
              :class="[
                'absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-r-8 border-t-4 border-b-4 border-t-transparent border-b-transparent',
                isDark ? 'border-r-slate-800' : 'border-r-white'
              ]"
            ></div>
          </div>
        </router-link>
      </div>
    </nav>

    <!-- Footer -->
    <div class="border-t p-4 space-y-3" :class="themeClasses.cardBorder">
      <!-- Theme Selector -->
      <div v-if="!sidebarCollapsed">
        <ThemeSelector />
      </div>
      
      <!-- User Profile -->
      <div v-if="!sidebarCollapsed" class="flex items-center gap-3">
        <div class="relative group">
          <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium', themeClasses.buttonPrimary]">
            {{ userInitials }}
          </div>
        </div>
        
        <div class="flex-1 min-w-0">
          <p :class="['text-sm font-medium truncate', themeClasses.textPrimary]">
            {{ displayName }}
          </p>
          <p :class="['text-xs truncate', themeClasses.textMuted]">
            {{ user?.email }}
          </p>
        </div>
        
        <button
          @click="handleLogout"
          :class="[
            'p-1.5 rounded-lg transition-colors duration-200',
            themeClasses.navItem
          ]"
        >
          <ArrowLeftOnRectangleIcon class="w-4 h-4" />
        </button>
      </div>
      
      <!-- Collapsed state - only logout button -->
      <div v-else class="flex justify-center">
        <button
          @click="handleLogout"
          :class="[
            'p-2 rounded-lg transition-colors duration-200',
            themeClasses.navItem,
            'group relative'
          ]"
        >
          <ArrowLeftOnRectangleIcon class="w-5 h-5" />
          
          <!-- Tooltip for collapsed state -->
          <div
            :class="[
              'absolute left-full ml-3 px-3 py-2 rounded-lg text-sm font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border backdrop-blur-sm',
              themeClasses.card,
              themeClasses.text,
              themeClasses.cardBorder
            ]"
            style="transform: translateY(-50%); top: 50%;"
          >
            Sign out
            <!-- Arrow pointer -->
            <div 
              :class="[
                'absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-r-8 border-t-4 border-b-4 border-t-transparent border-b-transparent',
                isDark ? 'border-r-slate-800' : 'border-r-white'
              ]"
            ></div>
          </div>
        </button>
      </div>
      
      <!-- Collapse Toggle (Desktop only) -->
      <button
        v-if="!isMobile"
        @click="$emit('toggleSidebar')"
        :class="[
          'w-full flex items-center justify-center py-2 rounded-lg transition-colors duration-200',
          themeClasses.navItem
        ]"
      >
        <ChevronLeftIcon v-if="!sidebarCollapsed" class="w-4 h-4" />
        <ChevronRightIcon v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure tooltips appear above other elements */
.group:hover .absolute {
  z-index: 9999;
}
</style>
