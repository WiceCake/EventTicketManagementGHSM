<script setup>
import { ref, computed, provide, watch, onMounted, onUnmounted } from "vue";
import { Squares2X2Icon } from "@heroicons/vue/24/solid";
import { useRoute } from "vue-router";
import SideBar from "./components/SideBar.vue";
import { useAuth } from './composables/useAuth'

const route = useRoute();
const { user, loading, isAuthenticated, error } = useAuth()

// Sidebar state management
const sidebarCollapsed = ref(false);
const isMobile = ref(false);
const showSidebar = computed(() => {
  // Check if current route should show sidebar
  return route.meta?.sidebar !== false;
});

// Provide sidebar state to child components
provide("sidebarCollapsed", sidebarCollapsed);
provide("isMobile", isMobile);

// Methods
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768;
  if (isMobile.value) {
    sidebarCollapsed.value = true;
  }
};

// Watch for route changes to handle sidebar state
watch(
  () => route.meta,
  (newMeta) => {
  },
  { immediate: true }
);

watch(route, (newRoute) => {
  // Auto-collapse sidebar on mobile when navigating
  if (window.innerWidth < 768) {
    sidebarCollapsed.value = true;
  }
});

onMounted(() => {
  checkScreenSize();
  window.addEventListener("resize", checkScreenSize);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkScreenSize);
});
</script>

<template>
  <div class="app-container min-h-screen bg-gray-100">
    <!-- Fixed Sidebar -->
    <aside v-show="showSidebar">
      <SideBar @toggleSidebar="toggleSidebar" />
    </aside>

    <!-- Mobile Backdrop - only show when sidebar is open on mobile -->
    <div
      v-if="showSidebar && !sidebarCollapsed && isMobile"
      class="fixed inset-0 bg-black bg-opacity-50 z-20"
      @click="toggleSidebar"
    ></div>

    <!-- Main Content with Dynamic Margin -->
    <main
      class="transition-all duration-300 ease-in-out"
      :class="{
        // When sidebar is hidden (login page)
        '': !showSidebar,
        // When sidebar is shown
        'ml-64': showSidebar && !sidebarCollapsed,
        'ml-20': showSidebar && sidebarCollapsed,
        // Mobile - no margin when sidebar is present
        'md:ml-64': showSidebar && !sidebarCollapsed,
        'md:ml-20': showSidebar && sidebarCollapsed
      }"
    >
      <!-- Mobile Header - only show when sidebar is enabled -->
      <header
        v-if="showSidebar"
        class="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between"
      >
        <h1 class="text-lg font-semibold text-gray-900">GHSM</h1>
        <button
          @click="toggleSidebar"
          class="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors duration-200"
        >
          <!-- Hamburger Menu Icon -->
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
          </svg>
        </button>
      </header>

      <!-- Show loading state -->
      <div v-if="loading" class="loading">
        Initializing authentication...
      </div>
      <div v-else-if="error" style="color:red;">Auth error: {{ error.message }}</div>
      
      <!-- Router View -->
      <div
        v-else
        class="min-h-screen"
        :class="{
          'bg-gray-50': showSidebar,
          'bg-white': !showSidebar
        }"
      >
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  min-height: 100vh;
}

/* Ensure smooth transitions */
main {
  transition-property: margin-left;
  transition-timing-function: ease-in-out;
  transition-duration: 300ms;
}

/* Mobile responsive adjustments */
@media (max-width: 767px) {
  main {
    margin-left: 0 !important;
  }
}

/* Prevent horizontal scroll */
html,
body {
  overflow-x: hidden;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 1.2rem;
}
</style>
