// Admin service for direct Supabase user management
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

class AdminService {
  constructor() {
    this.supabase = supabaseAdmin;
  }

  /**
   * Create a new user (admin only)
   * This creates both auth user and database entry
   */
  async createUser(userData) {
    try {
      // Step 1: Create auth user using admin API
      const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: userData.full_name,
          role: userData.role || 'user'
        }
      });

      if (authError) {
        console.error('Auth creation error:', authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      // Step 2: Create database entry
      const { data: dbUser, error: dbError } = await this.supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database creation error:', dbError);
        // If database creation fails, clean up auth user
        await this.supabase.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create database user: ${dbError.message}`);
      }

      return {
        success: true,
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          full_name: userData.full_name,
          role: userData.role || 'user'
        }
      };

    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  /**
   * Delete a user (admin only)
   * This deletes both database entry and auth user
   */
  async deleteUser(userId) {
    try {
      // Step 1: Delete from database (this will handle CASCADE)
      const { error: dbError } = await this.supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error(`Failed to delete database user: ${dbError.message}`);
      }

      // Step 2: Delete auth user
      const { error: authError } = await this.supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Auth deletion error:', authError);
        // Note: Database deletion already happened, but we should still report the error
        throw new Error(`User database entry deleted, but auth deletion failed: ${authError.message}`);
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };

    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  /**
   * Update user password (admin only)
   */
  async updateUserPassword(userId, newPassword) {
    try {
      const { data, error } = await this.supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        throw new Error(`Failed to update password: ${error.message}`);
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };

    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  }

  /**
   * Update user profile (admin only)
   */
  async updateUser(userId, userData) {
    try {
      // Update database
      const { data: dbUser, error: dbError } = await this.supabase
        .from('users')
        .update({
          full_name: userData.full_name,
          role: userData.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (dbError) {
        console.error('Database update error:', dbError);
        throw new Error(`Failed to update database user: ${dbError.message}`);
      }

      // Update auth user metadata
      const { data: authUser, error: authError } = await this.supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: userData.full_name,
          role: userData.role
        }
      });

      if (authError) {
        console.error('Auth update error:', authError);
        // Database was updated, but we should still report the issue
        console.warn('Database updated but auth metadata update failed:', authError.message);
      }

      return {
        success: true,
        user: dbUser
      };

    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  /**
   * Check if current user is admin
   */
  async isAdmin() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error || !user) {
        return false;
      }

      const { data: userData, error: dbError } = await this.supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (dbError) {
        console.error('Admin check error:', dbError);
        return false;
      }

      return userData.role === 'admin';

    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }
}

export const adminService = new AdminService();