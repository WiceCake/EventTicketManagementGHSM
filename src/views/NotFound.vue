<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'
import {
  HomeIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const { themeClasses } = useTheme()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.go(-1)
}
</script>

<template>
  <div :class="['min-h-screen flex items-center justify-center p-4', themeClasses.pageBackground]">
    <div class="max-w-md w-full text-center">
      <!-- 404 Illustration -->
      <div class="mb-8">
        <div class="relative">
          <!-- Large 404 Text -->
          <div :class="['text-8xl md:text-9xl font-bold select-none', themeClasses.textMuted, 'opacity-40']">
            404
          </div>
          <!-- Warning Icon Overlay -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="bg-yellow-600 rounded-full p-4 shadow-lg">
              <ExclamationTriangleIcon class="w-16 h-16 text-yellow-100" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div class="mb-8">
        <h1 :class="['text-2xl md:text-3xl font-bold mb-4', themeClasses.textPrimary]">
          Page Not Found
        </h1>
        <p :class="['mb-2', themeClasses.textSecondary]">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <p :class="['text-sm', themeClasses.textMuted]">
          The page may have been moved, deleted, or you entered the wrong URL.
        </p>
      </div>

      <!-- Current Path Info -->
      <div :class="['rounded-lg p-4 mb-8', themeClasses.cardBackground, themeClasses.cardBorder]">
        <div :class="['flex items-center justify-center text-sm', themeClasses.textMuted]">
          <MagnifyingGlassIcon class="w-4 h-4 mr-2" />
          <span class="font-mono break-all">{{ $route.fullPath }}</span>
        </div>
      </div>      <!-- Action Buttons -->
      <div class="space-y-4">
        <!-- Go Home Button -->
        <button
          @click="goHome"
          :class="['w-full inline-flex items-center justify-center px-6 py-3 font-medium rounded-lg transition-colors duration-200', themeClasses.buttonPrimary]"
        >
          <HomeIcon class="w-5 h-5 mr-2" />
          Go Home
        </button>

        <!-- Go Back Button -->
        <button
          @click="goBack"
          :class="['w-full inline-flex items-center justify-center px-6 py-3 border font-medium rounded-lg transition-colors duration-200', themeClasses.buttonSecondary, themeClasses.cardBorder]"
        >
          <ArrowLeftIcon class="w-5 h-5 mr-2" />
          Go Back
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.max-w-md {
  animation: fadeInUp 0.6s ease-out;
}
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
.bg-yellow-900 {
  animation: pulse 2s ease-in-out infinite;
}
</style>