import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const loading = ref(false)
const initialized = ref(false)
const userProfile = ref(null)

export const useAuth = () => {
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => userProfile.value?.role === 'admin')

  const signIn = async (email, password) => {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }
      user.value = data.user
      // Optionally, fetch user profile from your 'users' table
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      userProfile.value = profile
      return { user: data.user }
    } catch (err) {
      return { error: err }
    } finally {
      loading.value = false
    }
  }

  const signOut = async () => {
    loading.value = true
    try {
      await supabase.auth.signOut()
      user.value = null
      userProfile.value = null
    } finally {
      loading.value = false
    }
  }

  // Initialize auth state
  const initializeAuth = async () => {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.getSession()
      if (data?.session?.user) {
        user.value = data.session.user
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.value.email)
          .single()
        userProfile.value = profile
      }
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  // Dummy no-op function for static testing
  const refreshAuth = () => {
  }

  const resetPassword = async (email) => {
    // For development: Generate reset link and return it instead of sending email
    try {
      // First, try to send the reset email to get the token
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) {
        return { error: error.message };
      }
      
      // In development, we could also generate a manual reset token
      // For now, we'll just return success and let user check email
      // But we could modify this to show a direct link
      return { 
        success: true, 
        message: 'Password reset email sent! Check your inbox.',
        // For development, you could add a direct link here
        resetLink: null // We'll implement this below
      };
    } catch (err) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Alternative: Generate a direct reset link (for development)
  const generateResetLink = async (email) => {
    try {
      // This would require admin privileges to generate OTP directly
      // For now, we'll simulate a reset link for development
      const baseUrl = window.location.origin;
      const mockToken = 'dev-token-' + Date.now(); // In real app, this would be a proper token
      
      return {
        success: true,
        resetLink: `${baseUrl}/reset-password?token_hash=${mockToken}&type=recovery&email=${encodeURIComponent(email)}`,
        message: 'Reset link generated (development mode)'
      };
    } catch (err) {
      return { error: 'Failed to generate reset link' };
    }
  };

  // Password reset confirmation (PKCE flow)
  const confirmPasswordReset = async (tokenHash, type, newPassword) => {
    try {
      // Check if this is a development token FIRST - before any Supabase calls
      if (tokenHash && tokenHash.startsWith('dev-')) {
        console.log('Development mode: Actually updating password via backend API');
        
        // Extract email from dev token (format: dev-{timestamp}-{email})
        const parts = tokenHash.split('-');
        if (parts.length < 3) {
          return { error: 'Invalid development token format' };
        }
        
        const email = parts.slice(2).join('-'); // Rejoin in case email has dashes
        console.log('Extracted email from dev token:', email);
        
        try {
          // Call our backend API to actually update the password
          const response = await fetch('http://localhost:3001/dev-reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              newPassword: newPassword,
              token: tokenHash
            })
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            return { error: result.error || 'Failed to update password' };
          }
          
          return { 
            success: true, 
            message: 'Password updated successfully! (Development mode)',
            isDevelopment: true
          };
        } catch (apiError) {
          console.error('Backend API error:', apiError);
          return { error: 'Failed to connect to backend API. Please ensure the server is running.' };
        }
      }

      // Only proceed with Supabase verification for real tokens
      if (!tokenHash || !type) {
        return { error: 'Invalid token or type' };
      }

      // Real token verification for production
      // First verify the OTP token
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type
      });

      if (verifyError) {
        return { error: verifyError.message };
      }

      // If verification successful, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return { error: updateError.message };
      }

      return { success: true, message: 'Password updated successfully!' };
    } catch (err) {
      console.error('confirmPasswordReset error:', err);
      return { error: 'An unexpected error occurred' };
    }
  };

  // TEMPORARY: Direct password reset using service role key (for dev only)
  const adminResetPassword = async (email, newPassword) => {
    // This requires a service role key and should only be used server-side!
    // For demo, we'll simulate a failure (since frontend cannot do this securely)
    return { error: { message: 'Direct password reset is only available server-side with service role key.' } };
    // In a real backend, you would call:
    // await supabaseAdmin.auth.admin.updateUserByEmail(email, { password: newPassword })
  };

  // Find email by username (assuming 'username' field exists in 'users' table)
  const findEmailByUsername = async (username) => {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('username', username)
      .maybeSingle(); // Use maybeSingle to avoid error if no rows
    return { data, error };
  };

  return {
    user,
    loading,
    initialized,
    userProfile,
    isAuthenticated,
    isAdmin,
    signIn,
    signOut,
    initializeAuth,
    refreshAuth,
    resetPassword,
    generateResetLink,
    confirmPasswordReset,
    adminResetPassword,
    findEmailByUsername,
  }
}

// Auth guard function
export const authGuard = async (to, from, next) => {
  try {
    const { isAuthenticated, loading, initialized, getCurrentSession, refreshAuth } = useAuth()

    // Decision logic
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const isPublicRoute = ['/login', '/register'].includes(to.path)

    if (requiresAuth && !isAuthenticated.value) {
      next('/login')
      return
    }
    
    if (isPublicRoute && isAuthenticated.value) {
      next('/')
      return
    }
    
    next()
    
  } catch (error) {
    next('/login')
  }
}