<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  HomeIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.go(-1)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#181f2a] to-[#232b3b] flex items-center justify-center p-4">
    <div class="max-w-md w-full text-center">
      <!-- 404 Illustration -->
      <div class="mb-8">
        <div class="relative">
          <!-- Large 404 Text -->
          <div class="text-8xl md:text-9xl font-bold text-gray-800/40 select-none">
            404
          </div>
          <!-- Warning Icon Overlay -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="bg-yellow-900 rounded-full p-4 shadow-lg">
              <ExclamationTriangleIcon class="w-16 h-16 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-4">
          Page Not Found
        </h1>
        <p class="text-gray-300 mb-2">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <p class="text-sm text-gray-400">
          The page may have been moved, deleted, or you entered the wrong URL.
        </p>
      </div>

      <!-- Current Path Info -->
      <div class="bg-[#232b3b] rounded-lg p-4 mb-8">
        <div class="flex items-center justify-center text-sm text-gray-400">
          <MagnifyingGlassIcon class="w-4 h-4 mr-2" />
          <span class="font-mono break-all">{{ $route.fullPath }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-4">
        <!-- Go Home Button -->
        <button
          @click="goHome"
          class="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <HomeIcon class="w-5 h-5 mr-2" />
          Go Home
        </button>

        <!-- Go Back Button -->
        <button
          @click="goBack"
          class="w-full inline-flex items-center justify-center px-6 py-3 border border-gray-600 text-gray-200 font-medium rounded-lg hover:bg-[#232b3b] transition-colors duration-200"
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