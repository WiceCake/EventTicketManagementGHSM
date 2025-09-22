import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Configure CORS to allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://event-ticket-management-ghsm.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // This should be in your .env file
);

// Regular Supabase client for non-admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Middleware to verify admin authentication
async function verifyAdmin(req, res, next) {
  console.log('=== VERIFYING ADMIN ===');
  const authHeader = req.headers.authorization;
  console.log('Auth header present:', !!authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid Bearer token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token extracted, length:', token?.length);
  
  try {
    // Add retry logic for network issues
    let user, error;
    let retries = 2;
    
    while (retries > 0) {
      try {
        const result = await supabase.auth.getUser(token);
        user = result.data?.user;
        error = result.error;
        break; // Success, exit retry loop
      } catch (networkError) {
        console.log('Network error, retries left:', retries - 1);
        retries--;
        if (retries === 0) {
          error = networkError;
        } else {
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('getUser result - error:', error, 'user ID:', user?.id);
    
    if (error || !user) {
      console.log('Invalid token or user not found');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    console.log('Checking admin status for user:', user.id);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('User data query result:', { userData, userError });

    // Check if user has admin role
    if (userError || !userData || userData.role !== 'admin') {
      console.log('Admin access denied - userError:', userError, 'userData:', userData, 'role:', userData?.role);
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('Admin access granted for user:', user.id);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(500).json({ error: 'Auth verification failed' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_supabase_service_role_key_here'
  });
});

// Generate password reset link (for development/admin use)
app.post('/generate-reset-link', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
      return res.status(500).json({
        success: false,
        error: 'Supabase service role key not configured. Please update your .env file.',
        hint: 'Get your service role key from Supabase Dashboard > Settings > API'
      });
    }

    // Check if user exists in auth
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to check user',
        details: listError.message 
      });
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Generate recovery token using admin client
    const { data, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
      }
    });

    if (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to generate reset link',
        details: tokenError.message 
      });
    }

    // Extract token_hash from the generated link
    const url = new URL(data.properties.action_link);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');

    // Create our custom reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token_hash=${tokenHash}&type=${type}`;

    res.json({
      success: true,
      message: 'Reset link generated successfully',
      resetLink: resetLink,
      expiresAt: data.properties.email_otp?.expires_at,
      // Also return the original Supabase link for reference
      originalLink: data.properties.action_link
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Development-only password reset (bypasses email verification)
app.post('/dev-reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and new password are required' 
      });
    }

    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is only available in development mode'
      });
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
      return res.status(500).json({
        success: false,
        error: 'Supabase service role key not configured. Please update your .env file.',
        hint: 'Get your service role key from Supabase Dashboard > Settings > API'
      });
    }

    // Find user by email in auth system
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to find user',
        details: listError.message 
      });
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Update user password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to update password',
        details: updateError.message 
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully (development mode)'
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Development-only user deletion (bypasses admin verification)
app.delete('/admin/delete-user', async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }

    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is only available in development mode'
      });
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key_here') {
      return res.status(500).json({
        success: false,
        error: 'Supabase service role key not configured. Please update your .env file.',
        hint: 'Get your service role key from Supabase Dashboard > Settings > API'
      });
    }

    console.log('=== DELETE USER DEBUG ===');
    console.log('Request body:', { email, userId });
    console.log('UserId type:', typeof userId);
    console.log('Service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Service role key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
    console.log('Supabase URL:', process.env.VITE_SUPABASE_URL);

    // Find user by email in auth system
    console.log('Attempting to list users...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      console.error('Full error object:', JSON.stringify(listError, null, 2));
      return res.status(500).json({ 
        success: false,
        error: 'Failed to find user',
        details: listError.message 
      });
    }

    console.log('Successfully listed users, count:', users?.users?.length);
    const authUser = users.users.find(u => u.email === email);
    
    if (!authUser) {
      console.log('Available users:', users.users.map(u => u.email));
      return res.status(404).json({ 
        success: false,
        error: 'User not found in authentication system' 
      });
    }

    console.log('Found auth user:', authUser.id, authUser.email);

    // First, let's see what users exist in the custom table
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    console.log('Existing users in custom table with this email:', existingUsers);
    console.log('Fetch error:', fetchError);

    // Also check by ID if provided
    if (userId) {
      const { data: userById, error: fetchByIdError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId);
      
      console.log('User found by ID in custom table:', userById);
      console.log('Fetch by ID error:', fetchByIdError);
    }

    // Delete from public users table first - try both email and userId
    let customDeleteError;
    let deleteResult;
    
    // First try deleting by userId if provided
    if (userId) {
      const deleteByIdResult = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      customDeleteError = deleteByIdResult.error;
      deleteResult = deleteByIdResult;
      console.log('Attempted delete by userId:', userId);
      console.log('Delete result:', deleteByIdResult);
    }
    
    // If delete by userId failed or no userId provided, try by email
    if (customDeleteError || !userId) {
      const deleteByEmailResult = await supabase
        .from('users')
        .delete()
        .eq('email', email);
      
      customDeleteError = deleteByEmailResult.error;
      deleteResult = deleteByEmailResult;
      console.log('Attempted delete by email:', email);
      console.log('Delete result:', deleteByEmailResult);
    }

    // If both failed, try using the auth user's ID as a last resort
    if (customDeleteError) {
      console.log('Trying delete with auth user ID:', authUser.id);
      const deleteByAuthIdResult = await supabase
        .from('users')
        .delete()
        .eq('id', authUser.id);
      
      customDeleteError = deleteByAuthIdResult.error;
      deleteResult = deleteByAuthIdResult;
      console.log('Delete by auth ID result:', deleteByAuthIdResult);
    }

    console.log('Final custom delete error:', customDeleteError);
    console.log('Final delete result:', deleteResult);
    console.log('===========================');

    if (customDeleteError) {
      console.error('Custom user deletion error:', customDeleteError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to delete user record',
        details: customDeleteError.message 
      });
    }

    if (customDeleteError) {
      console.error('Custom user deletion error:', customDeleteError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to delete user record',
        details: customDeleteError.message 
      });
    }

    // Delete from auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (authDeleteError) {
      console.error('Auth user deletion error:', authDeleteError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to delete authentication user',
        details: authDeleteError.message 
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully (development mode)'
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Admin endpoint to create user
app.post('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    console.log('=== CREATE USER REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Requesting user:', req.user?.id);
    
    const { email, password, name, username, role = 'user' } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    console.log('Creating user with:', { email, name, username, role });

    // Create user in Supabase Auth using admin client
    console.log('Step 1: Creating auth user...');
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation for admin-created users
      user_metadata: {
        name,
        username: username || email.split('@')[0],
        role
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      
      // Handle specific error cases
      if (authError.code === 'email_exists') {
        return res.status(409).json({ 
          error: 'User with this email already exists',
          details: 'A user account with this email address is already registered in the system.'
        });
      }
      
      return res.status(400).json({ 
        error: 'Failed to create auth user',
        details: authError.message 
      });
    }

    console.log('Step 2: Auth user created successfully:', authUser.user.id);

    console.log('Step 2: Auth user created successfully:', authUser.user.id);

    // The trigger should automatically create the user profile
    // Wait a moment for the trigger to execute
    console.log('Step 3: Waiting for trigger to create profile...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the user profile was created and update if needed
    console.log('Step 4: Checking if profile was created by trigger...');
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    console.log('Profile check result:', { userProfile, profileError });

    if (profileError || !userProfile) {
      // Trigger didn't work, create manually
      console.log('Step 5: Trigger failed, creating profile manually...');
      const { data: customUser, error: customError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id, // Use the same UUID from auth.users
          email,
          full_name: name, // Store the full name in the full_name column
          username: username || email.split('@')[0],
          role,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (customError) {
        console.error('Custom user creation error:', customError);
        
        // Cleanup: delete the auth user if custom user creation failed
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
        
        return res.status(500).json({ 
          error: 'Failed to create user record',
          details: customError.message 
        });
      }

      console.log('Step 6: User profile created manually:', customUser.id);
      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: customUser.id,
          email: customUser.email,
          full_name: customUser.full_name,
          username: customUser.username,
          role: customUser.role,
          is_active: customUser.is_active,
          created_at: customUser.created_at
        }
      });
    } else {
      console.log('Step 6: Profile exists from trigger, checking role...');
      // Profile exists, update the role if different
      if (userProfile.role !== role) {
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            role,
            username: username || userProfile.username,
            updated_at: new Date().toISOString()
          })
          .eq('id', authUser.user.id)
          .select()
          .single();

        if (updateError) {
          console.error('User role update error:', updateError);
        }

        res.status(201).json({
          message: 'User created successfully',
          user: {
            id: updatedUser?.id || userProfile.id,
            email: updatedUser?.email || userProfile.email,
            full_name: updatedUser?.full_name || userProfile.full_name,
            username: updatedUser?.username || userProfile.username,
            role: updatedUser?.role || userProfile.role,
            is_active: updatedUser?.is_active || userProfile.is_active,
            created_at: updatedUser?.created_at || userProfile.created_at
          }
        });
      } else {
        res.status(201).json({
          message: 'User created successfully',
          user: {
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.full_name,
            username: userProfile.username,
            role: userProfile.role,
            is_active: userProfile.is_active,
            created_at: userProfile.created_at
          }
        });
      }
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Admin endpoint to update a user
app.put('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role } = req.body;

    // Update user in custom users table
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        email,
        name,
        role,
        is_admin: role === 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('User update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update user',
        details: updateError.message 
      });
    }

    // Update auth user email if it changed
    if (email) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { email }
      );

      if (authUpdateError) {
        console.error('Auth user update error:', authUpdateError);
        // Note: We don't fail the whole operation if auth update fails
      }
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        is_admin: updatedUser.is_admin,
        updated_at: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Admin endpoint to delete a user
app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete from custom users table first
    const { error: customDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (customDeleteError) {
      console.error('Custom user deletion error:', customDeleteError);
      return res.status(500).json({ 
        error: 'Failed to delete user record',
        details: customDeleteError.message 
      });
    }

    // Delete from auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error('Auth user deletion error:', authDeleteError);
      // Note: We don't fail the whole operation if auth deletion fails
    }

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
