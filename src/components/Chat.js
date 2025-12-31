import { useState, useRef, useEffect } from 'react';
import './Chat.css';
import { searchUsers } from '../services/userService';
import { getMessages, sendMessage, getContactsWithMessages } from '../services/messageService';

function Chat({ user, onSignOut }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const contactsRef = useRef([]);

  const CONTACTS_STORAGE_KEY = `chatApp_contacts_${user.id}`;
  const LAST_READ_STORAGE_KEY = `chatApp_lastRead_${user.id}`;

  // Load contacts from localStorage and backend on mount
  useEffect(() => {
    const loadContacts = async () => {
      try {
        // First, load from localStorage
        const savedContacts = localStorage.getItem(CONTACTS_STORAGE_KEY);
        let localContacts = [];
        if (savedContacts) {
          localContacts = JSON.parse(savedContacts);
        }

        // Then, fetch contacts from backend that have messages
        try {
          const backendContacts = await getContactsWithMessages();
          
          // Transform backend contacts to match our contact format
          const transformedBackendContacts = backendContacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
            lastMessage: contact.lastMessage || 'No messages yet',
            unread: 0,
          }));

          // Merge local and backend contacts, avoiding duplicates
          const contactMap = new Map();
          
          // Add local contacts first
          localContacts.forEach((contact) => {
            contactMap.set(contact.id, contact);
          });

          // Add or update with backend contacts (backend has more recent lastMessage)
          // Also calculate unread counts for all contacts
          const updateUnreadCounts = async () => {
            for (const contact of Array.from(contactMap.values())) {
              try {
                const messages = await getMessages(contact.id);
                const transformedMessages = messages.map((msg) => ({
                  id: msg.id,
                  text: msg.text,
                  sender: msg.senderId,
                  senderName: msg.senderName,
                  timestamp: msg.createdAt,
                }));
                const lastRead = getLastReadTimestamp(contact.id);
                const unreadCount = calculateUnreadCount(transformedMessages, contact.id, lastRead);
                
                const existing = contactMap.get(contact.id);
                if (existing) {
                  contactMap.set(contact.id, {
                    ...existing,
                    unread: unreadCount,
                  });
                }
              } catch (error) {
                console.error(`Error calculating unread for contact ${contact.id}:`, error);
              }
            }
            
            const mergedContacts = Array.from(contactMap.values());
            setContacts(mergedContacts);
          };

          transformedBackendContacts.forEach((contact) => {
            const existing = contactMap.get(contact.id);
            if (existing) {
              // Update last message if backend has a newer one
              contactMap.set(contact.id, {
                ...existing,
                lastMessage: contact.lastMessage,
              });
            } else {
              // Add new contact from backend
              contactMap.set(contact.id, contact);
            }
          });

          // Calculate unread counts for all contacts
          updateUnreadCounts();
        } catch (error) {
          console.error('Error loading contacts from backend:', error);
          // If backend fails, still use local contacts
          if (localContacts.length > 0) {
            setContacts(localContacts);
          }
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    };

    loadContacts();
  }, [CONTACTS_STORAGE_KEY]);

  // Save contacts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
      contactsRef.current = contacts; // Keep ref in sync
    } catch (error) {
      console.error('Error saving contacts to localStorage:', error);
    }
  }, [contacts, CONTACTS_STORAGE_KEY]);

  // Load messages when a contact is selected
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact.id);
    } else {
      setMessages([]);
    }
  }, [selectedContact]);

  // Mark messages as read when contact is selected and messages are loaded
  useEffect(() => {
    if (selectedContact && messages.length > 0) {
      // Small delay to ensure messages are displayed before marking as read
      const timer = setTimeout(() => {
        markAsRead(selectedContact.id, messages);
        // Force a poll update after marking as read to refresh unread counts
        // This ensures that when you click away, the counts are correct
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedContact?.id, messages.length]);

  // Poll for new messages to update unread counts continuously (lightweight, non-blocking)
  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;
    let isPolling = false;
    
    const updateUnreadForContact = async (contact) => {
      // Always calculate unread count for all contacts
      // If contact is selected and messages are marked as read, unread will be 0
      
      try {
        const messages = await getMessages(contact.id);
        const transformedMessages = messages.map((msg) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.senderId,
          senderName: msg.senderName,
          timestamp: msg.createdAt,
        }));
        
        const lastRead = getLastReadTimestamp(contact.id);
        const unreadCount = calculateUnreadCount(transformedMessages, contact.id, lastRead);
        
        return {
          ...contact,
          unread: unreadCount,
        };
      } catch (error) {
        console.error(`Error updating unread for contact ${contact.id}:`, error);
        return contact;
      }
    };
    
    const pollUnreadCounts = async () => {
      if (!isMounted || isPolling) return;
      
      isPolling = true;
      
      try {
        // Use functional update to get latest contacts from state
        setContacts((prevContacts) => {
          if (!prevContacts || prevContacts.length === 0) {
            isPolling = false;
            return prevContacts;
          }
          
          // Update unread counts asynchronously
          (async () => {
            try {
              const updatedContacts = [];
              for (const contact of prevContacts) {
                const updated = await updateUnreadForContact(contact);
                updatedContacts.push(updated);
                
                // Small delay between each contact to avoid blocking
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              
              if (isMounted) {
                setContacts(updatedContacts);
              }
            } catch (error) {
              console.error('Error in async unread update:', error);
            } finally {
              isPolling = false;
            }
          })();
          
          return prevContacts; // Return immediately, update will happen async
        });
      } catch (error) {
        console.error('Error polling unread counts:', error);
      } finally {
        isPolling = false;
      }
    };

    // Start polling after initial delay, then every 3 seconds (more frequent)
    const initialTimeout = setTimeout(() => {
      if (isMounted) {
        pollUnreadCounts();
        pollInterval = setInterval(pollUnreadCounts, 3000);
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedContact?.id]);

  // Poll for new messages when a contact is selected
  useEffect(() => {
    if (!selectedContact) return;

    const pollInterval = setInterval(() => {
      // Poll silently (without showing loading state) to check for new messages
      const contactId = selectedContact.id;
      loadMessages(contactId, true);
    }, 3000); // Check every 3 seconds

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.id]);

  // Periodically check for new contacts and update unread counts
  useEffect(() => {
    const checkForNewContacts = async () => {
      try {
        const backendContacts = await getContactsWithMessages();
        const transformedBackendContacts = backendContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          lastMessage: contact.lastMessage || 'No messages yet',
          unread: 0,
        }));

        // Update contacts list with any new contacts from backend
        setContacts((prevContacts) => {
          const contactMap = new Map();
          prevContacts.forEach((contact) => {
            contactMap.set(contact.id, contact);
          });

          transformedBackendContacts.forEach((contact) => {
            const existing = contactMap.get(contact.id);
            if (existing) {
              // Update last message
              contactMap.set(contact.id, {
                ...existing,
                lastMessage: contact.lastMessage,
              });
            } else {
              // Add new contact
              contactMap.set(contact.id, contact);
            }
          });

          // Update unread counts for all contacts (except currently selected)
          const updateUnreadCounts = async () => {
            const updatedContacts = Array.from(contactMap.values());
            for (const contact of updatedContacts) {
              // Skip if this contact is currently selected
              if (selectedContact?.id === contact.id) continue;
              
              try {
                const messages = await getMessages(contact.id);
                const transformedMessages = messages.map((msg) => ({
                  id: msg.id,
                  text: msg.text,
                  sender: msg.senderId,
                  senderName: msg.senderName,
                  timestamp: msg.createdAt,
                }));
                const lastRead = getLastReadTimestamp(contact.id);
                const unreadCount = calculateUnreadCount(transformedMessages, contact.id, lastRead);
                
                contactMap.set(contact.id, {
                  ...contact,
                  unread: unreadCount,
                });
              } catch (error) {
                console.error(`Error updating unread for contact ${contact.id}:`, error);
              }
            }
            
            setContacts(Array.from(contactMap.values()));
          };

          updateUnreadCounts();
          return Array.from(contactMap.values());
        });
      } catch (error) {
        console.error('Error checking for new contacts:', error);
      }
    };

    // Check for new contacts every 5 seconds
    const contactCheckInterval = setInterval(checkForNewContacts, 5000);
    
    // Also check immediately
    checkForNewContacts();

    return () => clearInterval(contactCheckInterval);
  }, [selectedContact?.id]);

  const loadMessages = async (contactId, silent = false) => {
    if (!silent) {
      setIsLoadingMessages(true);
    }
    try {
      const fetchedMessages = await getMessages(contactId);
      // Transform messages to match the format expected by the UI
      const transformedMessages = fetchedMessages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.senderId,
        senderName: msg.senderName,
        timestamp: msg.createdAt,
      }));
      
      // Only update if messages have changed (to avoid unnecessary re-renders during polling)
      setMessages((prevMessages) => {
        const prevIds = new Set(prevMessages.map(m => m.id));
        const newIds = new Set(transformedMessages.map(m => m.id));
        
        // Check if there are new messages
        const hasNewMessages = transformedMessages.some(m => !prevIds.has(m.id));
        const hasDifferentCount = prevMessages.length !== transformedMessages.length;
        
        if (hasNewMessages || hasDifferentCount) {
          return transformedMessages;
        }
        return prevMessages;
      });
      
      // Update last message in contacts and calculate unread count
      if (transformedMessages.length > 0) {
        const lastMessage = transformedMessages[transformedMessages.length - 1];
        updateContactLastMessage(contactId, lastMessage.text);
        
        // Always calculate unread count, but only update if contact is not selected
        // (if selected, it will be marked as read shortly)
        const lastRead = getLastReadTimestamp(contactId);
        const unreadCount = calculateUnreadCount(transformedMessages, contactId, lastRead);
        
        // Only update unread count if this contact is NOT currently selected
        // (selected contacts will be marked as read, so unread should be 0)
        if (selectedContact?.id !== contactId) {
          updateContactUnread(contactId, unreadCount);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      if (!silent) {
        setMessages([]);
      }
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  };

  const getLastReadTimestamp = (contactId) => {
    try {
      const lastReadData = localStorage.getItem(LAST_READ_STORAGE_KEY);
      if (lastReadData) {
        const parsed = JSON.parse(lastReadData);
        return parsed[contactId] || null;
      }
    } catch (error) {
      console.error('Error reading last read timestamp:', error);
    }
    return null;
  };

  const markAsRead = (contactId, messages) => {
    if (messages.length === 0) return;
    
    try {
      const lastReadData = localStorage.getItem(LAST_READ_STORAGE_KEY);
      const parsed = lastReadData ? JSON.parse(lastReadData) : {};
      
      // Get the most recent message timestamp
      const lastMessage = messages[messages.length - 1];
      parsed[contactId] = lastMessage.timestamp;
      
      localStorage.setItem(LAST_READ_STORAGE_KEY, JSON.stringify(parsed));
      
      // Update unread count to 0
      updateContactUnread(contactId, 0);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const calculateUnreadCount = (messages, contactId, lastReadTimestamp) => {
    if (!lastReadTimestamp) {
      // If no last read timestamp, count all messages received from this contact
      const unreadMessages = messages.filter(msg => {
        const senderId = msg.senderId || msg.sender;
        return senderId !== user.id;
      });
      console.log(`No last read timestamp for contact ${contactId}, unread count: ${unreadMessages.length}`);
      return unreadMessages.length;
    }
    
    // Count messages received after the last read timestamp
    // Use >= instead of > to handle edge cases, but we'll filter out exact matches
    const lastReadDate = new Date(lastReadTimestamp);
    const unreadMessages = messages.filter(msg => {
      const senderId = msg.senderId || msg.sender;
      const messageTime = new Date(msg.timestamp || msg.createdAt);
      // Message is unread if it's from the contact AND it's after the last read time
      // We use > (not >=) to exclude the message that was just marked as read
      const isUnread = senderId !== user.id && messageTime > lastReadDate;
      return isUnread;
    });
    
    console.log(`Contact ${contactId}: ${unreadMessages.length} unread messages (last read: ${lastReadTimestamp}, total messages: ${messages.length})`);
    return unreadMessages.length;
  };

  const updateContactUnread = (contactId, unreadCount) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) => {
        if (contact.id === contactId) {
          console.log(`Updating unread count for contact ${contactId}: ${unreadCount}`);
          return { ...contact, unread: unreadCount };
        }
        return contact;
      })
    );
  };

  const updateContactLastMessage = (contactId, lastMessageText) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) =>
        contact.id === contactId
          ? { ...contact, lastMessage: lastMessageText }
          : contact
      )
    );
  };

  const handleRemoveContact = (e, contactId) => {
    e.stopPropagation(); // Prevent selecting the contact when clicking close
    setContacts((prevContacts) => prevContacts.filter((contact) => contact.id !== contactId));
    
    // If the removed contact was selected, clear selection
    if (selectedContact?.id === contactId) {
      setSelectedContact(null);
      setMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    // Optimistically add message to UI
    const optimisticMessage = {
      id: Date.now(), // Temporary ID
      text: messageText,
      sender: user.id,
      senderName: user.name,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, optimisticMessage]);
    updateContactLastMessage(selectedContact.id, messageText);

    try {
      // Send message to backend - ensure receiverId is a number
      const receiverId = typeof selectedContact.id === 'number' 
        ? selectedContact.id 
        : parseInt(selectedContact.id);
      
      const savedMessage = await sendMessage(receiverId, messageText);
      
      // Replace optimistic message with real one from server
      setMessages((prevMessages) => {
        const filtered = prevMessages.filter((msg) => msg.id !== optimisticMessage.id);
        return [
          ...filtered,
          {
            id: savedMessage.id,
            text: savedMessage.text,
            sender: savedMessage.senderId,
            senderName: savedMessage.senderName || user.name,
            timestamp: savedMessage.createdAt,
          },
        ];
      });
      
      // Update last message in contacts
      updateContactLastMessage(selectedContact.id, messageText);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== optimisticMessage.id)
      );
      // Restore message text so user can retry
      setNewMessage(messageText);
      alert('Failed to send message. Please try again.');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddContact = (userToAdd) => {
    // Check if contact already exists
    const contactExists = contacts.find(c => c.id === userToAdd.id);
    if (contactExists) {
      // If exists, just select it
      setSelectedContact(contactExists);
    } else {
      // Add new contact
      const newContact = {
        id: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
        lastMessage: 'No messages yet',
        unread: 0,
      };
      setContacts([...contacts, newContact]);
      setSelectedContact(newContact);
    }
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="chat-app">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <div className="user-profile">
              <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-status">Online</div>
              </div>
            </div>
            <button onClick={onSignOut} className="sidebar-sign-out" title="Sign Out">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>

          <div className="contacts-section">
            <div className="contacts-header">
              <h3>Contacts</h3>
            </div>
            
            {/* Search Input */}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
              {isSearching && <div className="search-loading">Searching...</div>}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">Search Results</div>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="search-result-item"
                    onClick={() => handleAddContact(result)}
                  >
                    <div className="contact-avatar">{result.name.charAt(0).toUpperCase()}</div>
                    <div className="contact-info">
                      <div className="contact-name">{result.name}</div>
                    </div>
                    <div className="add-contact-icon">+</div>
                  </div>
                ))}
              </div>
            )}

            <div className="contacts-list">
              {contacts.length === 0 ? (
                <div className="no-contacts">
                  <p>No contacts yet</p>
                  <p className="no-contacts-hint">Contacts will appear here when you start chatting</p>
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`contact-item ${selectedContact?.id === contact.id ? 'active' : ''} ${contact.unread > 0 ? 'has-unread' : ''}`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="contact-avatar">{contact.name.charAt(0).toUpperCase()}</div>
                    <div className="contact-info">
                      <div className="contact-name">{contact.name}</div>
                      <div className="contact-last-message">{contact.lastMessage}</div>
                    </div>
                    {contact.unread > 0 && (
                      <div className="unread-badge">{contact.unread}</div>
                    )}
                    <button
                      className="contact-close-btn"
                      onClick={(e) => handleRemoveContact(e, contact.id)}
                      title="Remove contact"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">{selectedContact.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="chat-contact-name">{selectedContact.name}</div>
                    <div className="chat-contact-status">Online</div>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="messages-container">
                {isLoadingMessages ? (
                  <div className="no-messages">
                    <div className="no-messages-icon">💬</div>
                    <p>Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="no-messages-icon">💬</div>
                    <p>No messages yet</p>
                    <p className="no-messages-hint">Start the conversation by sending a message!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${message.sender === user.id || message.senderId === user.id ? 'sent' : message.sender === 'system' ? 'system' : 'received'}`}
                    >
                      {(message.sender !== 'system' && message.sender !== user.id && message.senderId !== user.id) && (
                        <div className="message-avatar">{message.senderName?.charAt(0).toUpperCase() || 'U'}</div>
                      )}
                      <div className="message-content">
                        {(message.sender !== 'system' && message.sender !== user.id && message.senderId !== user.id) && (
                          <div className="message-sender">{message.senderName}</div>
                        )}
                        <div className="message-text">{message.text}</div>
                        <div className="message-time">{formatTime(message.timestamp || message.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="message-input-container">
                <form onSubmit={handleSendMessage} className="message-form">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="message-input"
                  />
                  <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="no-contact-selected">
              <div className="no-contact-icon">💬</div>
              <h2>Select a contact to start chatting</h2>
              <p>Choose someone from the sidebar to begin a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chat;

