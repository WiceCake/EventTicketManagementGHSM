<template>
  <div :class="['flex items-center justify-center min-h-screen', themeClasses.pageBackground]">
    <div :class="['flex flex-col items-center gap-5 shadow-lg p-10 rounded-lg max-w-md w-full mx-4', themeClasses.cardBackground, themeClasses.cardBorder]">
      <img class="w-16 h-16" :src="logoSrc" alt="GREY Harmonics Logo" />
      <h1 :class="['text-2xl font-bold', themeClasses.textPrimary]">Reset Password</h1>

      <!-- Development Mode: Direct Password Reset -->
      <div v-if="isDevelopment" :class="['w-full p-4 rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20']">
        <h2 :class="['text-lg font-semibold mb-3 text-yellow-800 dark:text-yellow-200']">
          🚧 Development Mode - Direct Reset
        </h2>
        <p :class="['text-sm mb-4 text-yellow-700 dark:text-yellow-300']">
          Skip email verification and reset password directly for testing.
        </p>
        
        <form @submit.prevent="handleDirectPasswordReset" class="space-y-4">
          <div>
            <label :class="['block mb-1 text-sm font-medium text-yellow-800 dark:text-yellow-200']">
              Email Address
            </label>
            <input
              v-model="directResetEmail"
              type="email"
              :class="['w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500', themeClasses.input]"
              placeholder="Enter email to reset password for"
              required
            />
          </div>
          
          <div>
            <label :class="['block mb-1 text-sm font-medium text-yellow-800 dark:text-yellow-200']">
              New Password
            </label>
            <input
              v-model="directResetPassword"
              type="password"
              :class="['w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500', themeClasses.input]"
              placeholder="Enter new password"
              required
              minlength="6"
            />
          </div>
          
          <button
            type="submit"
            :disabled="directResetLoading"
            :class="['w-full py-2 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed']"
          >
            {{ directResetLoading ? 'Updating...' : 'Reset Password Directly' }}
          </button>
        </form>
      </div>

      <!-- Regular Reset Flow (for production) -->

      <!-- Toast Message -->
      <transition name="fade">
        <div v-if="toast.show" :class="['fixed top-6 left-1/2 z-50 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg', toast.type === 'error' ? themeClasses.statusError : themeClasses.statusSuccess]">
          {{ toast.message }}
        </div>
      </transition>

      <!-- Step 1: Request Password Reset -->
      <form v-if="!showResetForm && !showResetLink" @submit.prevent="handlePasswordResetRequest" class="w-full">
        <label for="email" :class="['block mb-2 text-sm font-medium', themeClasses.text]">
          Email Address
        </label>
        <div class="relative mb-6">
          <input
            v-model="email"
            type="email"
            id="email"
            :class="['w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent', themeClasses.input]"
            placeholder="Enter your email address"
            required
          />
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
            </svg>
          </div>
        </div>
        
        <button
          type="submit"
          :disabled="loading"
          :class="['w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors', loading ? 'cursor-not-allowed' : '']"
        >
          {{ loading ? 'Generating...' : 'Generate Reset Link' }}
        </button>
      </form>

      <!-- Step 1.5: Show Reset Link -->
      <div v-if="showResetLink && !showResetForm" class="w-full">
        <h2 :class="['text-lg font-semibold mb-4', themeClasses.textPrimary]">Reset Link Generated</h2>
        
        <div :class="['p-4 rounded-lg mb-4', themeClasses.cardBackground]">
          <p :class="['text-sm mb-3', themeClasses.text]">
            Click the button below to reset your password, or copy the link:
          </p>
          
          <!-- Reset Link Display -->
          <div :class="['p-3 rounded border bg-gray-50 dark:bg-gray-800 mb-3', themeClasses.border]">
            <code :class="['text-xs break-all', themeClasses.textSecondary]">
              {{ resetLink }}
            </code>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex gap-2 flex-col sm:flex-row">
            <button
              @click="openResetLink"
              class="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Reset Form
            </button>
            <button
              @click="copyResetLink"
              class="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
        
        <!-- Generate New Link -->
        <button
          @click="showResetLink = false; resetLink = ''"
          :class="['text-sm hover:underline', themeClasses.textSecondary]"
        >
          Generate new link
        </button>
      </div>

      <!-- Step 2: Reset Password Form (shown when user clicks email link) -->
      <form v-else @submit.prevent="handlePasswordReset" class="w-full">
        <!-- Development Mode Indicator -->
        <div v-if="route.query.token_hash && route.query.token_hash.startsWith('dev-')" :class="['mb-4 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700']">
          <p :class="['text-sm text-yellow-800 dark:text-yellow-200']">
            🚧 <strong>Development Mode:</strong> This is a test reset link. Password changes will be simulated.
          </p>
        </div>

        <label for="newPassword" :class="['block mb-2 text-sm font-medium', themeClasses.text]">
          New Password
        </label>
        <div class="relative mb-4">
          <input
            v-model="newPassword"
            :type="showPassword ? 'text' : 'password'"
            id="newPassword"
            :class="['w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent', themeClasses.input]"
            placeholder="Enter new password"
            required
            minlength="6"
          />
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            <svg v-if="showPassword" class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path>
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path>
            </svg>
            <svg v-else class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path>
            </svg>
          </button>
        </div>

        <label for="confirmPassword" :class="['block mb-2 text-sm font-medium', themeClasses.text]">
          Confirm New Password
        </label>
        <div class="relative mb-6">
          <input
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            id="confirmPassword"
            :class="['w-full pl-12 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent', themeClasses.input]"
            placeholder="Confirm new password"
            required
            minlength="6"
          />
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <button
            type="button"
            @click="showConfirmPassword = !showConfirmPassword"
            class="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            <svg v-if="showConfirmPassword" class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path>
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path>
            </svg>
            <svg v-else class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path>
            </svg>
          </button>
        </div>
        
        <button
          type="submit"
          :disabled="loading || newPassword !== confirmPassword"
          :class="['w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors', (loading || newPassword !== confirmPassword) ? 'cursor-not-allowed' : '']"
        >
          {{ loading ? 'Updating...' : 'Update Password' }}
        </button>
      </form>

      <!-- Back to login link -->
      <router-link to="/login" :class="['text-sm hover:underline', themeClasses.textSecondary]">
        Back to Login
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTheme } from '../composables/useTheme';
import logoImgNormal from "../assets/ghsm-normal.svg";
import logoImgInverted from "../assets/inverted-ghsm-logo.svg";

const router = useRouter();
const route = useRoute();
const { requestPasswordReset, confirmPasswordReset } = useAuth();
const { themeClasses, currentTheme } = useTheme();

// Computed logo based on theme
const logoSrc = computed(() => {
  return currentTheme.value === 'dark' ? logoImgInverted : logoImgNormal;
});

// Component state
const loading = ref(false);
const email = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const showResetForm = ref(false);
const resetLink = ref('');
const showResetLink = ref(false);

// Development direct reset
const isDevelopment = ref(import.meta.env.DEV);
const directResetEmail = ref('');
const directResetPassword = ref('');
const directResetLoading = ref(false);

// Toast state
const toast = ref({ show: false, message: '', type: 'error' });
let toastTimeout = null;

const showToast = (message, type = 'error') => {
  toast.value = { show: true, message, type };
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.value.show = false;
  }, 5000);
};

// Development-only direct password reset (no email verification)
const handleDirectPasswordReset = async () => {
  if (!directResetEmail.value || !directResetPassword.value) {
    showToast('Please fill in all fields');
    return;
  }

  if (directResetPassword.value.length < 6) {
    showToast('Password must be at least 6 characters long');
    return;
  }

  directResetLoading.value = true;
  
  try {
    // Call backend API directly to update password
    const response = await fetch('http://localhost:3001/dev-reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: directResetEmail.value,
        newPassword: directResetPassword.value,
        token: `dev-direct-${Date.now()}-${directResetEmail.value}` // Fake token for logging
      })
    });
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      showToast('Server returned invalid response. Check if backend is running on port 3001.');
      return;
    }
    
    if (!response.ok) {
      showToast(result.error || `Server error: ${response.status}`);
      return;
    }
    
    showToast('Password updated successfully! You can now sign in.', 'success');
    
    // Clear form
    directResetEmail.value = '';
    directResetPassword.value = '';
    
    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push('/login');
    }, 2000);
    
  } catch (error) {
    console.error('Direct reset error:', error);
    showToast('Failed to connect to server. Make sure the backend is running.');
  } finally {
    directResetLoading.value = false;
  }
};

// Handle password reset request
const handlePasswordResetRequest = async () => {
  if (!email.value) {
    showToast('Please enter your email address');
    return;
  }

  loading.value = true;
  try {
    // First try the backend API
    try {
      const response = await fetch('http://localhost:3001/generate-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        resetLink.value = result.resetLink;
        showResetLink.value = true;
        showToast('Reset link generated! Click the link below or copy it.', 'success');
        return;
      } else {
        if (result.error.includes('service role key')) {
          showToast('Backend configuration issue. Using fallback method...', 'warning');
          throw new Error('Service key not configured');
        }
        throw new Error(result.error || 'Failed to generate reset link');
      }
    } catch (fetchError) {
      console.warn('Backend server issue, using fallback method:', fetchError.message);
      
      // Fallback: Generate a development reset link
      const mockTokenHash = 'dev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
      const baseUrl = window.location.origin;
      resetLink.value = `${baseUrl}/reset-password?token_hash=${mockTokenHash}&type=recovery&email=${encodeURIComponent(email.value)}`;
      showResetLink.value = true;
      
      if (fetchError.message.includes('ERR_CONNECTION_REFUSED')) {
        showToast('Server not running. Generated development reset link. (Note: This is a mock link for testing)', 'success');
      } else if (fetchError.message.includes('service role key')) {
        showToast('Server configuration needed. Generated development reset link for now.', 'success');
      } else {
        showToast('Generated development reset link. (Backend had an issue)', 'success');
      }
    }
  } catch (err) {
    console.error('Error generating reset link:', err);
    showToast('An unexpected error occurred');
  } finally {
    loading.value = false;
  }
};

// Copy reset link to clipboard
const copyResetLink = async () => {
  try {
    await navigator.clipboard.writeText(resetLink.value);
    showToast('Reset link copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    showToast('Failed to copy link. Please select and copy manually.');
  }
};

// Navigate to reset link
const openResetLink = () => {
  // Extract the path and query from the reset link
  const url = new URL(resetLink.value);
  
  // Update the current page URL and show the reset form
  router.replace(url.pathname + url.search);
  
  // Force show the reset form
  showResetForm.value = true;
  showResetLink.value = false;
};

// Handle password reset confirmation
const handlePasswordReset = async () => {
  console.log('=== PASSWORD RESET HANDLER CALLED ===');
  
  // Check for dev token data in sessionStorage first
  const devResetData = sessionStorage.getItem('devResetData');
  let tokenHash, tokenType, email;
  
  if (devResetData) {
    console.log('Found dev reset data in sessionStorage');
    const devData = JSON.parse(devResetData);
    tokenHash = devData.tokenHash;
    tokenType = devData.type;
    email = devData.email;
    
    // Clear the stored data
    sessionStorage.removeItem('devResetData');
  } else {
    // Use route query parameters
    tokenHash = route.query.token_hash;
    tokenType = route.query.type;
    email = route.query.email;
  }

  if (!newPassword.value || !confirmPassword.value) {
    showToast('Please fill in all fields');
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    showToast('Passwords do not match');
    return;
  }

  if (newPassword.value.length < 6) {
    showToast('Password must be at least 6 characters long');
    return;
  }

  loading.value = true;
  try {
    const isDevToken = tokenHash?.startsWith('dev-');
    
    console.log('Token details:');
    console.log('- tokenHash:', tokenHash);
    console.log('- tokenType:', tokenType);
    console.log('- email:', email);
    console.log('- isDev:', isDevToken);

    if (!tokenHash || !tokenType) {
      showToast('Invalid reset link. Please request a new password reset.');
      return;
    }

    // Always use confirmPasswordReset - it handles both dev and real tokens
    console.log('Calling confirmPasswordReset...');
    const result = await confirmPasswordReset(tokenHash, tokenType, newPassword.value);
    
    if (result.error) {
      console.log('Password reset error:', result.error);
      showToast(result.error);
    } else {
      console.log('Password reset successful:', result.message);
      showToast(result.message, 'success');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
  } catch (err) {
    console.error('Password reset error:', err);
    showToast('An unexpected error occurred: ' + err.message);
  } finally {
    loading.value = false;
  }
};

// Check if we're in reset mode (user clicked email link)
onMounted(() => {
  const hasResetParams = route.query.token_hash && route.query.type;
  
  // Debug logging
  console.log('Reset password mounted with query:', route.query);
  console.log('token_hash:', route.query.token_hash);
  console.log('Is dev token?', route.query.token_hash?.startsWith('dev-'));
  
  // IMPORTANT: If this is a dev token, clean the URL immediately to prevent Supabase auto-detection
  if (hasResetParams && route.query.token_hash?.startsWith('dev-')) {
    console.log('Development token detected - cleaning URL to prevent Supabase interference');
    
    // Store the dev token data locally
    const devTokenData = {
      tokenHash: route.query.token_hash,
      type: route.query.type,
      email: route.query.email
    };
    
    // Store in sessionStorage temporarily
    sessionStorage.setItem('devResetData', JSON.stringify(devTokenData));
    
    // Clean the URL to prevent Supabase from seeing the dev token
    router.replace('/reset-password');
    
    // Show the form
    showResetForm.value = true;
    showResetLink.value = false;
    
    return;
  }
  
  // For real tokens or no tokens, proceed normally
  showResetForm.value = hasResetParams;
  
  // If we have dev token params, don't show the reset link section
  if (hasResetParams && route.query.token_hash?.startsWith('dev-')) {
    showResetLink.value = false;
    console.log('Development token detected, hiding reset link section');
  }
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>