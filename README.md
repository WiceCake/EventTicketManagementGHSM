# Vue 3 + Vite Event Management System

A Vue.js event management application with Supabase backend for admin user creation and management.

## Features

- 🎫 Event and ticket management
- 👥 User administration with secure password creation
- 🔐 Authentication with Supabase
- 📱 QR code scanning for tickets
- 🎨 Dark/Light theme support
- 🔒 Row-level security (RLS) with Supabase

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
VITE_API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

### 3. Supabase Database Setup

Make sure your Supabase database has the following table structure:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can update users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );
```

### 4. Running the Application

Start both the frontend and backend servers:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend API:**
```bash
npm run server:dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## API Endpoints

### Admin User Management

- `POST /api/admin/users` - Create a new user
- `PUT /api/admin/users/:id` - Update a user
- `DELETE /api/admin/users/:id` - Delete a user

All endpoints require admin authentication via Bearer token.

## Admin User Creation

The system supports secure admin user creation with the following features:

1. **Frontend Form**: Admin can enter email, password, name, and role
2. **Backend API**: Securely creates users in both Supabase Auth and custom users table
3. **Error Handling**: Comprehensive error handling with rollback on failures
4. **Authentication**: Uses Supabase service role key for admin operations

## Security Features

- Row-level security (RLS) policies
- Admin-only user creation endpoints
- Secure password handling
- JWT token authentication
- Service role key separation

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).
