// API service for backend communication
import { supabase } from './supabase.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getAuthToken() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // Admin user management endpoints
  async createUser(userData) {
    return this.makeRequest('/api/admin/users', {
      method: 'POST',
      body: userData
    });
  }

  async updateUser(userId, userData) {
    return this.makeRequest(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: userData
    });
  }

  async deleteUser(userId) {
    return this.makeRequest(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return await response.json();
    } catch (error) {
      throw new Error('Backend server is not available');
    }
  }
}

export const apiService = new ApiService();
