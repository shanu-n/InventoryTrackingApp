import AsyncStorage from '@react-native-async-storage/async-storage';

// Authentication service with persistence and better error handling
class AuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.baseURL = 'https://your-api-endpoint.com/api'; // Replace with your actual API
    this.initializeAuth();
  }

  // Initialize auth state from storage
  async initializeAuth() {
    try {
      const userData = await AsyncStorage.getItem('user');
      const authToken = await AsyncStorage.getItem('authToken');
      
      if (userData && authToken) {
        this.currentUser = JSON.parse(userData);
        this.isAuthenticated = true;
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  // Mock login function with persistence
  async login(email, password) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Mock validation - replace with real API call
      const validCredentials = [
        { email: 'demo@inventory.com', password: 'demo123', name: 'Demo User' },
        { email: 'admin@inventory.com', password: 'admin123', name: 'Admin User' },
        { email: 'test@test.com', password: 'test123', name: 'Test User' },
      ];

      const user = validCredentials.find(
        cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
      );

      if (user || (email && password && password.length >= 6)) {
        const userData = user || {
          email: email,
          name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
        };

        this.currentUser = {
          id: Date.now().toString(),
          email: userData.email,
          name: userData.name,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        
        this.isAuthenticated = true;

        // Simulate auth token
        const authToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store in AsyncStorage for persistence
        await AsyncStorage.setItem('user', JSON.stringify(this.currentUser));
        await AsyncStorage.setItem('authToken', authToken);
        
        return {
          success: true,
          user: this.currentUser,
          token: authToken,
        };
      } else {
        throw new Error('Invalid email or password');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Logout with cleanup
  async logout() {
    try {
      this.currentUser = null;
      this.isAuthenticated = false;
      
      // Clear stored data
      await AsyncStorage.multiRemove(['user', 'authToken']);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  // Mock registration function
  async register(email, password, name) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user creation - replace with real API call
      if (email && password && name && password.length >= 6) {
        const userData = {
          id: Date.now().toString(),
          email: email,
          name: name,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };

        this.currentUser = userData;
        this.isAuthenticated = true;
        
        const authToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('authToken', authToken);
        
        return {
          success: true,
          user: userData,
          token: authToken,
        };
      } else {
        throw new Error('Invalid registration data');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Mock password reset function
  async resetPassword(email) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!email) {
        throw new Error('Email is required');
      }

      // Mock email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // In a real app, this would send an API request to your backend
      return {
        success: true,
        message: `Password reset instructions have been sent to ${email}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update user profile
  async updateProfile(updates) {
    try {
      if (!this.isAuthenticated || !this.currentUser) {
        throw new Error('User not authenticated');
      }

      const updatedUser = {
        ...this.currentUser,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.currentUser = updatedUser;
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      return {
        success: true,
        user: updatedUser,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get auth token
  async getAuthToken() {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Validate current session
  async validateSession() {
    try {
      const token = await this.getAuthToken();
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        this.currentUser = JSON.parse(userData);
        this.isAuthenticated = true;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  // Mock API call helper (for future real API integration)
  async apiCall(endpoint, method = 'GET', data = null) {
    try {
      const token = await this.getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const config = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
      }

      // This would be your actual API call
      // const response = await fetch(`${this.baseURL}${endpoint}`, config);
      // return response.json();

      // For now, return mock success
      return {
        success: true,
        message: 'Mock API call successful',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export a singleton instance
export default new AuthService();