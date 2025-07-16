import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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

// Admin endpoint to create a new user
app.post('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    // Create user in Supabase Auth using admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation for admin-created users
      user_metadata: {
        name,
        role
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return res.status(400).json({ 
        error: 'Failed to create auth user',
        details: authError.message 
      });
    }

    // Create user record in custom users table
    const { data: customUser, error: customError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        name,
        role,
        is_admin: role === 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: customUser.id,
        email: customUser.email,
        name: customUser.name,
        role: customUser.role,
        is_admin: customUser.is_admin,
        created_at: customUser.created_at
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
