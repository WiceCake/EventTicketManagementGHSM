<script setup>
import { inject, ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import logoImg from "../assets/ghsm-normal.svg";
import {
  QrCodeIcon,
  ClipboardDocumentIcon,
  InboxIcon,
  Squares2X2Icon,
  TicketIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  CalendarDaysIcon  // ✅ Add this import for Events icon
} from "@heroicons/vue/24/solid";
import { useAuth } from '../composables/useAuth'

// Props & Emits
const emit = defineEmits(["toggleSidebar"]);

// Router
const router = useRouter();
const route = useRoute();

// ✅ FIX: Add loading to the destructured properties
const { userProfile, signOut, refreshAuth, loading } = useAuth()

// Injected state
const sidebarCollapsed = inject("sidebarCollapsed");

// Local reactive state
const isMobile = ref(false);
const logo = ref(logoImg);

// Update the currentUser ref to use real data
const currentUser = computed(() => {
  if (userProfile.value) {
    return {
      name: userProfile.value.full_name,
      username: userProfile.value.username,
      role: userProfile.value.role === 'admin' ? 'Administrator' : 'Staff',
      avatar: null
    }
  }
  return {
    name: "Loading...",
    username: "...",
    role: "...",
    avatar: null
  }
})

// Navigation items configuration
const navigationItems = [
  {
    name: "Home",
    path: "/",
    icon: InboxIcon,
    exact: true
  },
  {
    name: "Scanner",
    path: "/qrcode",
    icon: QrCodeIcon,
    exact: true
  },
  {
    name: "History",
    path: "/qrcode/history",
    icon: ClipboardDocumentIcon,
    exact: true
  },
];

// ✅ Admin navigation items - ADD Events here
const adminNavigationItems = [
  {
    name: "Events",  
    path: "/admin/events",  // ✅ This matches your router
    icon: CalendarDaysIcon,
    exact: true
  },
  {
    name: "Users",
    path: "/admin/user",
    icon: UsersIcon,
    exact: true
  },
  {
    name: "Tickets",
    path: "/admin/ticket",
    icon: TicketIcon,
    exact: true
  },
];

// Computed properties
const sidebarClasses = computed(() => [
  'fixed top-0 left-0 h-full py-4 bg-[#181f2a] border-r border-[#232b3b] z-30 transition-all duration-300 ease-in-out flex flex-col',
  // Desktop behavior
  !isMobile.value && (sidebarCollapsed.value ? 'w-20 px-2' : 'w-64 px-6'),
  // Mobile behavior - completely hide when collapsed
  isMobile.value && (sidebarCollapsed.value 
    ? '-translate-x-full w-0 opacity-0 pointer-events-none' 
    : 'translate-x-0 w-64 px-6 opacity-100')
]);

const menuButtonClasses = computed(() => [
  'menu-btn transition-all duration-300 ease-in-out cursor-pointer z-10',
  !sidebarCollapsed.value
    ? 'absolute p-2 bg-gray-100 rounded-sm mb-3'
    : 'p-2 rounded-sm mb-3 mx-auto',
  sidebarCollapsed.value ? '' : 'rotate-45',
]);

const navigationClasses = computed(() => [
  'flex-1 px-3 py-4',
  sidebarCollapsed.value && !isMobile.value 
    ? 'overflow-visible' 
    : 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100'
]);

// Computed: Show admin section for admin, show tickets for staff
const showAdminSection = computed(() => userProfile.value && userProfile.value.role === 'admin')
const showTicketsForStaff = computed(() => userProfile.value && userProfile.value.role === 'staff')

// Methods
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768;
};

const handleToggleSidebar = () => {
  emit('toggleSidebar');
};

const handleNavClick = () => {
  if (isMobile.value) {
    emit('toggleSidebar');
  }
};

// Get nav item classes for RouterLink
const getNavItemClasses = (item) => {
  return [
    'group flex items-center rounded-lg transition-all duration-300 text-gray-300 hover:bg-[#232b3b] hover:text-white no-underline nav-link cursor-pointer',
    sidebarCollapsed.value && !isMobile.value
      ? 'justify-center p-3 w-12 h-12 mx-auto'
      : 'gap-3 p-3'
  ].join(' ')
};

const getIconClasses = (item) => 
  (sidebarCollapsed.value && !isMobile.value) ? 'w-6 h-6' : 'w-5 h-5';

// Check if route is active
const isRouteActive = (itemPath, exact = false) => {
  if (exact) {
    return route.path === itemPath;
  }
  return route.path.startsWith(itemPath);
};

// ✅ UPDATED: Navigation click handler with router readiness check
const handleNavigation = async (path) => {
  try {
    
    // Handle logout specially
    if (path === 'signout') {
      
      // Close sidebar first if mobile
      if (isMobile.value) {
        emit("toggleSidebar")
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Sign out
      const result = await signOut()
      const error = result ? result.error : undefined;
      
      if (error) {
        console.error('Logout error:', error)
        // Even if error, still redirect to login
      }
      
      await router.push('/login')
      return
    }
    
    // Prevent navigation to same route
    if (route.path === path) {
      if (isMobile.value) {
        emit("toggleSidebar")
      }
      return
    }
    
    // Close sidebar on mobile for normal navigation
    if (isMobile.value) {
      emit("toggleSidebar")
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    await router.push(path)
    
  } catch (error) {
    console.error('SideBar: Navigation error', error)
    // On any error, redirect to login
    router.push('/login')
  }
};

const handleLogout = async () => {
  try {
    const { error } = await signOut()
    
    if (!error) {
      // Successful logout, redirect to login
      await router.push('/login')
    } else {
      console.error('Logout error:', error)
    }
  } catch (err) {
    console.error('Logout error:', err)
  }
};

// ✅ UPDATED: Lifecycle hooks without visibility change listener
onMounted(async () => {
  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);
  
  // Ensure router is ready
  try {
    await router.isReady();
  } catch (error) {
    console.error('Router readiness check failed:', error);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize);
});
</script>

<template>
  <div :class="sidebarClasses">
    <!-- Toggle Button - Desktop Only -->
    <div
      v-if="!isMobile"
      :class="menuButtonClasses"
      @click="handleToggleSidebar"
    >
      <Squares2X2Icon class="w-8 h-8 transition-transform duration-300 ease-in-out" />
    </div>

    <!-- Header Section -->
    <header class="mb-4">
      <!-- Expanded Header -->
      <div
        v-show="!sidebarCollapsed"
        class="header h-20 flex items-center gap-3 px-4 transition-opacity duration-300"
      >
        <img
          class="w-12 h-12 object-cover rounded"
          :src="logo"
          alt="Grey Harmonics Logo"
        />
        <div class="transition-all duration-300 ease-in-out">
          <p class="text-xl font-bold text-white">GHSM</p>
          <p class="text-xs text-gray-400">GREY Harmonics School of Music</p>
        </div>
      </div>

      <!-- Collapsed Header - Desktop Only -->
      <div 
        v-show="sidebarCollapsed && !isMobile" 
        class="header h-20 flex items-center justify-center transition-opacity duration-300"
      >
        <img
          class="w-8 h-8 object-cover rounded"
          :src="logo"
          alt="Grey Harmonics Logo"
        />
      </div>
    </header>

    <!-- Divider -->
    <hr
      v-show="!sidebarCollapsed"
      class="h-px my-4 bg-gray-200 border-0 transition-opacity duration-300"
    />

    <!-- Navigation Section -->
    <nav :class="navigationClasses">
      <!-- Main Menu Section -->
      <div class="space-y-6">
        <div>
          <h3 
            v-show="!sidebarCollapsed" 
            class="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider transition-opacity duration-300"
          >
            Main Menu
          </h3>
          
          <!-- Main Navigation Items -->
          <ul class="space-y-1">
            <li 
              v-for="item in navigationItems" 
              :key="item.path"
              class="nav-item-container"
            >
              <div
                @click="handleNavigation(item.path)"
                :class="[
                  getNavItemClasses(item),
                  isRouteActive(item.path, item.exact) ? 'nav-active' : ''
                ]"
              >
                <!-- Icon -->
                <component 
                  :is="item.icon" 
                  :class="getIconClasses(item)" 
                />
                
                <!-- Label -->
                <span
                  v-show="!sidebarCollapsed || isMobile"
                  class="transition-opacity duration-300 font-medium"
                >
                  {{ item.name }}
                </span>
                
                <!-- Tooltip - Desktop Collapsed Only -->
                <div
                  v-if="sidebarCollapsed && !isMobile"
                  class="tooltip absolute left-full top-1/2 transform -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50"
                >
                  {{ item.name }}
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Admin Section - Show only for admin users -->
        <div v-if="showAdminSection">
          <h3 
            v-show="!sidebarCollapsed" 
            class="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider transition-opacity duration-300"
          >
            Administration
          </h3>

          <!-- Admin Navigation Items -->
          <ul class="space-y-1">
            <li 
              v-for="adminItem in adminNavigationItems" 
              :key="adminItem.path"
              class="nav-item-container"
            >
              <div
                @click="handleNavigation(adminItem.path)"
                :class="[
                  getNavItemClasses(adminItem),
                  isRouteActive(adminItem.path, adminItem.exact) ? 'nav-active' : ''
                ]"
              >
                <!-- Icon -->
                <component 
                  :is="adminItem.icon" 
                  :class="getIconClasses(adminItem)" 
                />
                
                <!-- Label -->
                <span
                  v-show="!sidebarCollapsed || isMobile"
                  class="transition-opacity duration-300 font-medium"
                >
                  {{ adminItem.name }}
                </span>
                
                <!-- Tooltip - Desktop Collapsed Only -->
                <div
                  v-if="sidebarCollapsed && !isMobile"
                  class="tooltip absolute left-full top-1/2 transform -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50"
                >
                  {{ adminItem.name }}
                </div>
              </div>
            </li>
          </ul>
        </div>
        <!-- Tickets for staff (not admin) -->
        <div v-else-if="showTicketsForStaff">
          <h3 v-show="!sidebarCollapsed" class="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider transition-opacity duration-300">
            Tickets
          </h3>
          <ul class="space-y-1">
            <li class="nav-item-container">
              <div
                @click="handleNavigation('/admin/ticket')"
                :class="[getNavItemClasses({}), isRouteActive('/admin/ticket', true) ? 'nav-active' : '']"
              >
                <TicketIcon :class="getIconClasses({})" />
                <span v-show="!sidebarCollapsed || isMobile" class="transition-opacity duration-300 font-medium">
                  Tickets
                </span>
                <div v-if="sidebarCollapsed && !isMobile" class="tooltip absolute left-full top-1/2 transform -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                  Tickets
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- User section -->
    <div class="border-t border-[#232b3b] p-4">
      <!-- User info - only show when not collapsed -->
      <div v-if="!sidebarCollapsed" class="flex items-center space-x-3 mb-3">
        <UserCircleIcon class="h-8 w-8 text-gray-400" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">
            {{ userProfile?.full_name || userProfile?.username || userProfile?.email }}
          </p>
          <p class="text-xs text-gray-400 truncate">
            {{ userProfile?.role || 'User' }}
          </p>
        </div>
      </div>
      
      <!-- Sign out button - changes based on collapsed state -->
      <button
        @click="handleNavigation('signout')"
        :class=" [
          'w-full flex items-center justify-center rounded-lg transition-colors cursor-pointer',
          sidebarCollapsed 
            ? 'p-1 text-red-400 hover:bg-[#232b3b]' 
            : 'px-4 py-2 text-red-400 bg-[#232b3b] hover:bg-[#232b3b]/80'
        ]"
        :disabled="loading"
        :title="sidebarCollapsed ? 'Sign out' : ''"
      >
        <!-- Icon for collapsed state -->
        <ArrowRightOnRectangleIcon 
          v-if="sidebarCollapsed" 
          class="h-8 w-8" 
        />
        
        <!-- Full text for expanded state -->
        <template v-else>
          <span v-if="!loading">Sign out</span>
          <span v-else class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing out...
          </span>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Navigation Item Container - provides proper overflow handling */
.nav-item-container {
  position: relative;
  overflow: visible;
}

/* Navigation Link Styling */
.nav-link {
  position: relative;
  border-radius: 0.5rem;
}

/* Active State Styling */
.nav-active {
  background-color: #3b82f6 !important;
  color: #fff !important;
}

.nav-active:hover {
  background-color: #2563eb !important;
  color: #fff !important;
}

/* Regular nav link hover */
.nav-link:not(.nav-active):hover {
  background-color: #232b3b !important;
  color: #fff !important;
}

/* Focus styles */
.nav-link:focus,
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  z-index: 10;
}

/* Menu Button Positioning */
.menu-btn {
  right: -25px;
  top: 90px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-btn:hover {
  background-color: #e5e7eb;
}

/* Tooltip Hover Effect */
.group:hover .tooltip {
  opacity: 1;
}

/* Custom Scrollbar Styling */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Logout Button Container */
.logout-container {
  position: relative;
  overflow: visible;
}

/* Logout Button Styling */
.logout-btn {
  color: #dc2626;
  cursor: pointer;
  position: relative;
}

.logout-btn:hover {
  background-color: #fef2f2 !important;
  color: #b91c1c !important;
}

.logout-btn:focus {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
  z-index: 10;
}

/* Tooltip z-index */
.tooltip {
  z-index: 1000;
}

/* Ensure proper cursor */
.cursor-pointer {
  cursor: pointer;
}
</style>