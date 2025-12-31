// Message service for sending and fetching messages
import { getToken } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get all contacts that have conversations with the current user
export const getContactsWithMessages = async () => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/messages/contacts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch contacts');
    }

    return data.data.contacts;
  } catch (error) {
    throw error;
  }
};

// Get messages for a conversation with a contact
export const getMessages = async (contactId) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/messages/${contactId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch messages');
    }

    return data.data.messages;
  } catch (error) {
    throw error;
  }
};

// Send a message
export const sendMessage = async (receiverId, text) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Ensure receiverId is a number
    const receiverIdNum = typeof receiverId === 'number' ? receiverId : parseInt(receiverId);
    
    if (isNaN(receiverIdNum)) {
      throw new Error('Invalid receiver ID');
    }

    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverId: receiverIdNum, text }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send message');
    }

    return data.data.message;
  } catch (error) {
    throw error;
  }
};

