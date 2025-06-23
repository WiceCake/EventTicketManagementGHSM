<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import logoImgNormal from "../assets/ghsm-normal.svg";
import logoImgInverted from "../assets/inverted-ghsm-logo.svg";
import {
  UserIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/24/solid";
import { useRouter } from "vue-router";
import { useAuth } from '../composables/useAuth';
import { useTheme } from '../composables/useTheme';

const showPassword = ref(false);
const router = useRouter();
const { signIn, isAuthenticated, loading } = useAuth();
const { themeClasses, currentTheme } = useTheme();

// Computed logo based on theme
const logoSrc = computed(() => {
  return currentTheme.value === 'dark' ? logoImgInverted : logoImgNormal;
});

// Toast state
const toast = ref({ show: false, message: '', type: 'error' });
let toastTimeout = null;

// Form state
const username = ref('');
const password = ref('');
const error = ref('');
const isSubmitting = ref(false);

// Password reset state
const showResetModal = ref(false);
const resetEmail = ref('');
const resetLoading = ref(false);
const resetMessage = ref('');

// Direct password reset state (temporary, for development)
const showDirectResetModal = ref(false);
const directResetEmail = ref('');
const directNewPassword = ref('');
const directConfirmPassword = ref('');
const directResetLoading = ref(false);
const directResetMessage = ref('');

const showToast = (message, type = 'error') => {
  toast.value = { show: true, message, type };
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const handlelogin = async () => {
  if (!username.value || !password.value) {
    error.value = 'Please fill in all fields';
    showToast(error.value, 'error');
    return;
  }

  try {
    isSubmitting.value = true;
    error.value = '';

    // Query Supabase for email by username
    let email = '';
    const { data: userData, error: userLookupError } = await useAuth().findEmailByUsername(username.value);
    if (userLookupError) {
      error.value = 'Error looking up username.';
      showToast(error.value, 'error');
      isSubmitting.value = false;
      return;
    }
    if (!userData || !userData.email) {
      error.value = 'Invalid username';
      showToast(error.value, 'error');
      isSubmitting.value = false;
      return;
    }
    email = userData.email;

    toast.value.show = false;
    await nextTick();

    const result = await signIn(email, password.value);
    const { data, error: signInError, user } = result;
    let loginError = signInError || result.error;
    if (loginError) {
      let msg = 'Invalid username or password';
      if (loginError.message) {
        msg = loginError.message;
      }
      error.value = msg;
      showToast(error.value, 'error');
      await nextTick();
      isSubmitting.value = false;
      return;
    }

    if ((data && data.user) || user) {
      router.push('/');
    } else {
      error.value = 'Login failed. Please try again.';
      showToast(error.value, 'error');
      await nextTick();
    }
  } catch (err) {
    error.value = 'An unexpected error occurred';
    showToast(error.value, 'error');
    await nextTick();
  } finally {
    isSubmitting.value = false;
  }
};

const handlePasswordReset = async () => {
  resetMessage.value = '';
  if (!resetEmail.value) {
    resetMessage.value = 'Please enter your email.';
    return;
  }
  resetLoading.value = true;
  try {
    const { error } = await useAuth().resetPassword(resetEmail.value);
    if (error) {
      resetMessage.value = error.message || 'Failed to send reset email.';
    } else {
      resetMessage.value = 'Password reset email sent! Check your inbox.';
    }
  } catch (err) {
    resetMessage.value = 'An error occurred.';
  } finally {
    resetLoading.value = false;
  }
};

const handleDirectPasswordReset = async () => {
  directResetMessage.value = '';
  if (!directResetEmail.value || !directNewPassword.value || !directConfirmPassword.value) {
    directResetMessage.value = 'Please fill in all fields.';
    return;
  }
  if (directNewPassword.value !== directConfirmPassword.value) {
    directResetMessage.value = 'Passwords do not match.';
    return;
  }
  directResetLoading.value = true;
  try {
    // Call local Node.js API endpoint
    const response = await fetch('http://localhost:4000/admin-reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: directResetEmail.value, newPassword: directNewPassword.value })
    });
    const result = await response.json();
    if (result.success) {
      directResetMessage.value = 'Password updated successfully!';
    } else {
      directResetMessage.value = result.error || 'Failed to reset password.';
    }
  } catch (err) {
    directResetMessage.value = 'An error occurred.';
  } finally {
    directResetLoading.value = false;
  }
};

// Check if already authenticated
onMounted(() => {
  if (isAuthenticated.value) {
    router.push('/');
  }
});
</script>

<template>
  <div :class="['flex items-center justify-center min-h-screen', themeClasses.pageBackground]">
    <div :class="['flex flex-col items-center gap-5 shadow-lg p-10 rounded-lg max-w-md w-full mx-4', themeClasses.cardBackground, themeClasses.cardBorder]">      <img class="w-16 h-16" :src="logoSrc" alt="GREY Harmonics Logo" />
      <h1 :class="['text-2xl font-bold', themeClasses.textPrimary]">Sign In</h1><!-- Toast Message (single source of error feedback) -->
      <transition name="fade">
        <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg', toast.type === 'error' ? themeClasses.statusError : themeClasses.statusSuccess]">
          {{ toast.message }}
        </div>
      </transition>

      <form @submit.prevent="handlelogin" class="w-full">
        <!-- Username Field -->
        <label
          for="username"
          :class="['block mb-2 text-sm font-medium', themeClasses.text]"
        >Username</label>
        <div class="relative mb-6">          <div
            class="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none z-10"
          >
            <UserIcon :class="['w-5 h-5', themeClasses.iconPrimary]" />
          </div>
          <input
            v-model="username"
            type="text"
            id="username"
            required
            autocomplete="username"
            :class="[
              'border text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5',
              themeClasses.input,
              themeClasses.inputBorder
            ]"
            placeholder="Enter your username"
          />
        </div>

        <!-- Password Field -->
        <label
          for="password"
          :class="['block mb-2 text-sm font-medium', themeClasses.text]"
        >Your Password</label>
        <div class="relative mb-6">          <div
            class="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none z-10"
          >
            <KeyIcon :class="['w-5 h-5', themeClasses.iconPrimary]" />
          </div>
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            id="password"
            required
            autocomplete="current-password"
            :class="[
              'border text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 pe-10 p-2.5',
              themeClasses.input,
              themeClasses.inputBorder
            ]"
            placeholder="*******"
          />          <div
            class="absolute inset-y-0 end-0 flex items-center pe-3.5 cursor-pointer z-10"
            @click="showPassword = !showPassword"
          >
            <EyeIcon v-show="!showPassword" :class="['w-5 h-5 transition-colors hover:text-blue-400', themeClasses.iconPrimary]" />
            <EyeSlashIcon
              v-show="showPassword"
              :class="['w-5 h-5 transition-colors hover:text-blue-400', themeClasses.iconPrimary]"
            />
          </div>
        </div>        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isSubmitting || loading"
          :class="[
            'font-medium rounded-lg text-sm px-5 py-2.5 w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
            themeClasses.buttonPrimary
          ]"
        >
          <span v-if="isSubmitting || loading" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
          </span>
          <span v-else>Sign In</span>
        </button>
      </form>      <!-- Footer -->
      <p :class="['text-xs text-center mt-4', themeClasses.textMuted]">
        &copy; 2025 Grey Harmonics School of Music
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>