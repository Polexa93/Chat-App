// Contact service - manage the current user's saved contacts (separate from chat/message history)
import { getToken } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }

  return data;
};

// Get the current user's saved contacts
export const getContacts = async () => {
  const response = await apiRequest('/contacts');
  return response.data.contacts;
};

// Add a user to the current user's saved contacts
export const addContact = async (contactId) => {
  const response = await apiRequest('/contacts', {
    method: 'POST',
    body: JSON.stringify({ contactId }),
  });
  return response.data.contact;
};

// Remove a user from the current user's saved contacts
export const removeContact = async (contactId) => {
  await apiRequest(`/contacts/${contactId}`, { method: 'DELETE' });
};
