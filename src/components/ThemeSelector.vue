<script setup>
import { ref } from 'vue'
import { useTheme } from '../composables/useTheme'
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/vue/24/outline'

const { currentTheme, themes, setTheme, themeClasses } = useTheme()

const isOpen = ref(false)

const themeOptions = [
  {
    value: themes.LIGHT,
    label: 'Light',
    icon: SunIcon,
    description: 'Light theme'
  },
  {
    value: themes.DARK,
    label: 'Dark',
    icon: MoonIcon,
    description: 'Dark theme'
  },
  {
    value: themes.SYSTEM,
    label: 'System',
    icon: ComputerDesktopIcon,
    description: 'Follow system preference'
  }
]

function selectTheme(theme) {
  setTheme(theme)
  isOpen.value = false
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
  if (!event.target.closest('.theme-selector')) {
    isOpen.value = false
  }
}

// Add click outside listener
document.addEventListener('click', handleClickOutside)
</script>

<template>
  <div class="theme-selector relative">
    <!-- Theme Toggle Button -->
    <button
      @click="toggleDropdown"
      :class="[
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
        themeClasses.buttonSecondary,
        'border text-sm font-medium'
      ]"
      aria-label="Select theme"
    >
      <component 
        :is="themeOptions.find(opt => opt.value === currentTheme)?.icon || ComputerDesktopIcon" 
        class="w-4 h-4" 
      />
      <span class="hidden sm:inline">
        {{ themeOptions.find(opt => opt.value === currentTheme)?.label || 'Theme' }}
      </span>      <ChevronDownIcon 
        :class="[
          'w-4 h-4 transition-transform duration-200',
          isOpen ? 'rotate-180' : ''
        ]"
      />
    </button>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >      <div
        v-if="isOpen"
        :class="[
          'absolute right-0 bottom-full mb-2 w-48 rounded-lg shadow-lg border z-50',
          themeClasses.modal,
          'py-1'
        ]"
      >
        <button
          v-for="option in themeOptions"
          :key="option.value"
          @click="selectTheme(option.value)"
          :class="[
            'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-150',
            currentTheme === option.value 
              ? themeClasses.navItemActive 
              : themeClasses.navItem,
            'text-sm'
          ]"
        >
          <component :is="option.icon" class="w-4 h-4 flex-shrink-0" />
          <div class="flex-1">
            <div class="font-medium">{{ option.label }}</div>
            <div :class="['text-xs', themeClasses.textMuted]">
              {{ option.description }}
            </div>
          </div>
          <CheckIcon 
            v-if="currentTheme === option.value" 
            class="w-4 h-4 flex-shrink-0" 
          />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Custom dropdown animation */
.theme-selector {
  --dropdown-offset: 8px;
}
</style>
