// User service for searching users
import { getToken } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Search users by name or email
export const searchUsers = async (query) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to search users');
    }

    return data.data.users;
  } catch (error) {
    throw error;
  }
};

