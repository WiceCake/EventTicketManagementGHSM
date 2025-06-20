import { supabase } from '../lib/supabase'

export async function authGuard(to, from, next) {
  // Check if user is logged in via Supabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && to.name !== 'login') {
    // Not logged in, redirect to login
    return next({ name: 'login' })
  } else if (user && to.name === 'login') {
    // Already logged in, redirect to home
    return next({ name: 'home' })
  } else {
    // Proceed as normal
    return next()
  }
}

export async function adminGuard(to, from, next) {
  // Check if user is logged in and is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return next({ name: 'login' })
  }
  // Fetch user profile/role from your users table
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error || !data || data.role !== 'admin') {
    // Not admin, redirect to home or show error
    return next({ name: 'home' })
  }
  return next()
}

export async function adminOrStaffGuard(to, from, next) {
  // Check if user is logged in and is admin or staff
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return next({ name: 'login' })
  }
  // Fetch user profile/role from your users table
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error || !data || (data.role !== 'admin' && data.role !== 'staff')) {
    // Not admin or staff, redirect to home or show error
    return next({ name: 'home' })
  }
  return next()
}