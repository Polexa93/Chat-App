// Authentication service - Backend API integration

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'chatApp_token';
const USER_KEY = 'chatApp_user';

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }

  return data;
};

// Sign up a new user
export const signUp = async (name, email, password) => {
  try {
    const response = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (response.success && response.data) {
      // Store token and user
      setToken(response.data.token);
      setCurrentUser(response.data.user);
      return response.data.user;
    }

    throw new Error(response.message || 'Sign up failed');
  } catch (error) {
    throw error;
  }
};

// Sign in a user
export const signIn = async (email, password) => {
  try {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      // Store token and user
      setToken(response.data.token);
      setCurrentUser(response.data.user);
      return response.data.user;
    }

    throw new Error(response.message || 'Login failed');
  } catch (error) {
    throw error;
  }
};

// Get current logged-in user
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error reading current user:', error);
    return null;
  }
};

// Set current user (for session)
const setCurrentUser = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving session:', error);
  }
};

// Get JWT token
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// Set JWT token
const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

// Sign out
export const signOut = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return getToken() !== null && getCurrentUser() !== null;
};

// Verify token and get current user from server
export const verifyAuth = async () => {
  try {
    const token = getToken();
    if (!token) {
      return null;
    }

    const response = await apiRequest('/auth/me');
    if (response.success && response.data) {
      setCurrentUser(response.data.user);
      return response.data.user;
    }

    // Token invalid, clear storage
    signOut();
    return null;
  } catch (error) {
    // Token invalid or expired
    signOut();
    return null;
  }
};

