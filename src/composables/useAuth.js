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
    // Supabase: send password reset email
    return await supabase.auth.resetPasswordForEmail(email);
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