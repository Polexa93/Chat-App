import { useState, useRef, useEffect } from 'react';
import './Chat.css';
import { searchUsers } from '../services/userService';
import { getMessages, sendMessage, getContactsWithMessages } from '../services/messageService';
import { getContacts as getSavedContacts, addContact as addContactApi, removeContact as removeContactApi } from '../services/contactService';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { getEffectiveStatus, STATUS_LABELS, IDLE_THRESHOLD_MS, HEARTBEAT_INTERVAL_MS } from '../utils/presence';
import Avatar from './Avatar';
import ProfileSettingsModal from './ProfileSettingsModal';

// Small colored dot reflecting online / away / offline status
function StatusDot({ status }) {
  return <span className={`status-dot status-dot-${status}`} />;
}

// A single row in either the "Contacts" or "All Chats" list
function ContactRow({ person, isActive, isSaved, onSelect, onAddToContacts, onRemove, removeTitle }) {
  const effectiveStatus = getEffectiveStatus(person.status, person.lastActive);
  return (
    <div
      className={`contact-item ${isActive ? 'active' : ''} ${person.unread > 0 ? 'has-unread' : ''}`}
      onClick={() => onSelect(person)}
    >
      <div className="avatar-wrapper">
        <Avatar name={person.name} avatarUrl={person.avatarUrl} className="contact-avatar" />
        <StatusDot status={effectiveStatus} />
      </div>
      <div className="contact-info">
        <div className="contact-name">{person.name}</div>
        <div className="contact-last-message">{person.lastMessage || 'No messages yet'}</div>
      </div>
      {person.unread > 0 && <div className="unread-badge">{person.unread}</div>}
      <div className="contact-item-actions">
        {!isSaved && onAddToContacts && (
          <button
            className="contact-add-btn"
            onClick={(e) => onAddToContacts(e, person)}
            title="Add to Contacts"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            className="contact-close-btn"
            onClick={(e) => onRemove(e, person.id)}
            title={removeTitle || 'Remove'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Collapsible header for a contacts-list group ("Contacts" / "All Chats")
function ContactsGroupHeader({ title, isOpen, onToggle }) {
  return (
    <button type="button" className="contacts-group-header" onClick={onToggle}>
      <svg
        className={`contacts-group-chevron ${isOpen ? 'open' : ''}`}
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span className="contacts-group-title">{title}</span>
    </button>
  );
}

// Chat bubble icon used across empty states
function ChatBubbleIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  );
}

const transformMessage = (msg) => ({
  id: msg.id,
  text: msg.text,
  sender: msg.senderId,
  senderName: msg.senderName,
  timestamp: msg.createdAt,
});

function Chat({ user, onSignOut, onUpdateUser }) {
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [myStatus, setMyStatus] = useState('online');
  const [savedContacts, setSavedContacts] = useState([]);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const contactsRef = useRef([]);
  const selectedContactRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const typingTimeoutRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const CONTACTS_STORAGE_KEY = `chatApp_contacts_${user.id}`;
  const LAST_READ_STORAGE_KEY = `chatApp_lastRead_${user.id}`;

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  // Connect the realtime socket for the lifetime of the chat screen
  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  // Track own presence: flip to "away" after IDLE_THRESHOLD_MS of no activity,
  // and push status changes over the socket (the server marks us online/offline
  // automatically based on the socket connection itself).
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      setMyStatus((prev) => {
        if (prev === 'away') {
          getSocket()?.emit('presence:set', 'online');
          return 'online';
        }
        return prev;
      });
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity));

    const idleCheckInterval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      const nextStatus = idleFor >= IDLE_THRESHOLD_MS ? 'away' : 'online';
      setMyStatus((prev) => {
        if (prev !== nextStatus) getSocket()?.emit('presence:set', nextStatus);
        return nextStatus;
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(idleCheckInterval);
    };
  }, []);

  // Realtime event listeners: new messages, presence, profile changes, typing
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (rawMessage) => {
      const transformed = transformMessage(rawMessage);
      const otherPartyId = rawMessage.senderId === user.id ? rawMessage.receiverId : rawMessage.senderId;
      const isOpenChat = selectedContactRef.current?.id === otherPartyId;

      if (isOpenChat) {
        setMessages((prev) => (prev.some((m) => m.id === transformed.id) ? prev : [...prev, transformed]));
      }

      const existsInContacts = contactsRef.current.some((c) => c.id === otherPartyId);
      if (existsInContacts) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === otherPartyId
              ? {
                  ...c,
                  lastMessage: transformed.text,
                  unread: rawMessage.senderId !== user.id && !isOpenChat ? (c.unread || 0) + 1 : c.unread,
                }
              : c
          )
        );
      } else {
        // Brand-new conversation partner we haven't seen before - fetch their full profile
        refreshChatsList();
      }
    };

    const handlePresenceUpdate = ({ userId, status, lastActive }) => {
      const patch = (list) => list.map((c) => (c.id === userId ? { ...c, status, lastActive } : c));
      setContacts(patch);
      setSavedContacts(patch);
      setSelectedContact((prev) => (prev?.id === userId ? { ...prev, status, lastActive } : prev));
    };

    const handleProfileUpdate = ({ id, name, avatarUrl }) => {
      const patch = (list) => list.map((c) => (c.id === id ? { ...c, name, avatarUrl } : c));
      setContacts(patch);
      setSavedContacts(patch);
      setSelectedContact((prev) => (prev?.id === id ? { ...prev, name, avatarUrl } : prev));
    };

    const handleTypingStart = ({ fromUserId }) => {
      if (selectedContactRef.current?.id === fromUserId) setIsContactTyping(true);
    };

    const handleTypingStop = ({ fromUserId }) => {
      if (selectedContactRef.current?.id === fromUserId) setIsContactTyping(false);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('profile:update', handleProfileUpdate);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('profile:update', handleProfileUpdate);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved contacts from the backend. Presence/profile changes arrive live via
  // sockets, so this only needs to run occasionally as a safety net.
  useEffect(() => {
    let isMounted = true;

    const loadSavedContacts = async () => {
      try {
        const list = await getSavedContacts();
        if (isMounted) setSavedContacts(list);
      } catch (error) {
        console.error('Error loading saved contacts:', error);
      }
    };

    loadSavedContacts();
    const interval = setInterval(loadSavedContacts, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Re-fetch the "All Chats" list from the backend, adding any brand-new
  // conversation partners without disturbing unread counts already in state.
  const refreshChatsList = async () => {
    try {
      const backendContacts = await getContactsWithMessages();
      const transformed = backendContacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        lastMessage: c.lastMessage || 'No messages yet',
        unread: 0,
        status: c.status,
        lastActive: c.lastActive,
        avatarUrl: c.avatarUrl,
      }));

      setContacts((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        transformed.forEach((c) => {
          if (!map.has(c.id)) map.set(c.id, c);
        });
        return Array.from(map.values());
      });
    } catch (error) {
      console.error('Error refreshing chats list:', error);
    }
  };

  // Load contacts (chats) from localStorage and backend on mount
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
            status: contact.status,
            lastActive: contact.lastActive,
            avatarUrl: contact.avatarUrl,
          }));

          // Merge local and backend contacts, avoiding duplicates
          const contactMap = new Map();

          // Add local contacts first
          localContacts.forEach((contact) => {
            contactMap.set(contact.id, contact);
          });

          transformedBackendContacts.forEach((contact) => {
            const existing = contactMap.get(contact.id);
            if (existing) {
              // Update last message and presence if backend has newer info
              contactMap.set(contact.id, {
                ...existing,
                lastMessage: contact.lastMessage,
                status: contact.status,
                lastActive: contact.lastActive,
                avatarUrl: contact.avatarUrl,
              });
            } else {
              // Add new contact from backend
              contactMap.set(contact.id, contact);
            }
          });

          // Calculate initial unread counts (backlog from before this session)
          for (const contact of Array.from(contactMap.values())) {
            try {
              const { messages: fetched } = await getMessages(contact.id, { limit: 200 });
              const transformedMessages = fetched.map(transformMessage);
              const lastRead = getLastReadTimestamp(contact.id);
              const unreadCount = calculateUnreadCount(transformedMessages, contact.id, lastRead);

              const existing = contactMap.get(contact.id);
              if (existing) {
                contactMap.set(contact.id, { ...existing, unread: unreadCount });
              }
            } catch (error) {
              console.error(`Error calculating unread for contact ${contact.id}:`, error);
            }
          }

          setContacts(Array.from(contactMap.values()));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CONTACTS_STORAGE_KEY]);

  // Save contacts to localStorage whenever they change, and keep a ref in sync
  // for use inside long-lived socket listeners.
  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
      contactsRef.current = contacts;
    } catch (error) {
      console.error('Error saving contacts to localStorage:', error);
    }
  }, [contacts, CONTACTS_STORAGE_KEY]);

  // Load messages when a contact is selected
  useEffect(() => {
    setIsContactTyping(false);
    if (selectedContact) {
      loadMessages(selectedContact.id);
    } else {
      setMessages([]);
      setHasMoreMessages(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.id]);

  // Mark messages as read when contact is selected and messages are loaded
  useEffect(() => {
    if (selectedContact && messages.length > 0) {
      const timer = setTimeout(() => {
        markAsRead(selectedContact.id, messages);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.id, messages.length]);

  const loadMessages = async (contactId) => {
    setIsLoadingMessages(true);
    setHasMoreMessages(false);
    try {
      const { messages: fetched, hasMore } = await getMessages(contactId, { limit: 50 });
      const transformed = fetched.map(transformMessage);
      setMessages(transformed);
      setHasMoreMessages(hasMore);

      if (transformed.length > 0) {
        updateContactLastMessage(contactId, transformed[transformed.length - 1].text);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedContact || !hasMoreMessages || isLoadingOlderMessages) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    setIsLoadingOlderMessages(true);
    try {
      const { messages: fetched, hasMore } = await getMessages(selectedContact.id, { before: oldestId, limit: 50 });
      const transformed = fetched.map(transformMessage);
      shouldAutoScrollRef.current = false;
      setMessages((prev) => [...transformed, ...prev]);
      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlderMessages(false);
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

      const lastMessage = messages[messages.length - 1];
      parsed[contactId] = lastMessage.timestamp;

      localStorage.setItem(LAST_READ_STORAGE_KEY, JSON.stringify(parsed));
      updateContactUnread(contactId, 0);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const calculateUnreadCount = (messages, contactId, lastReadTimestamp) => {
    if (!lastReadTimestamp) {
      return messages.filter((msg) => (msg.senderId || msg.sender) !== user.id).length;
    }

    const lastReadDate = new Date(lastReadTimestamp);
    return messages.filter((msg) => {
      const senderId = msg.senderId || msg.sender;
      const messageTime = new Date(msg.timestamp || msg.createdAt);
      return senderId !== user.id && messageTime > lastReadDate;
    }).length;
  };

  const updateContactUnread = (contactId, unreadCount) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) => (contact.id === contactId ? { ...contact, unread: unreadCount } : contact))
    );
  };

  const updateContactLastMessage = (contactId, lastMessageText) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) => (contact.id === contactId ? { ...contact, lastMessage: lastMessageText } : contact))
    );
  };

  const handleRemoveContact = (e, contactId) => {
    e.stopPropagation();
    setContacts((prevContacts) => prevContacts.filter((contact) => contact.id !== contactId));

    if (selectedContact?.id === contactId) {
      setSelectedContact(null);
      setMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
    shouldAutoScrollRef.current = true;
  }, [messages]);

  const stopTypingSignal = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (selectedContact) {
      getSocket()?.emit('typing:stop', { toUserId: selectedContact.id });
    }
  };

  const handleMessageInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!selectedContact) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing:start', { toUserId: selectedContact.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { toUserId: selectedContact.id });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    stopTypingSignal();

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
      const receiverId = typeof selectedContact.id === 'number'
        ? selectedContact.id
        : parseInt(selectedContact.id);

      const savedMessage = await sendMessage(receiverId, messageText);

      // Replace optimistic message with the real one from the server
      // (the server also pushes this same message back over the socket -
      // that handler dedupes by id, so this just settles first)
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

      updateContactLastMessage(selectedContact.id, messageText);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== optimisticMessage.id));
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

  const handleAddContact = async (userToAdd) => {
    // Persist as a saved contact
    try {
      const added = await addContactApi(userToAdd.id);
      setSavedContacts((prev) => (prev.some((c) => c.id === added.id) ? prev : [added, ...prev]));
    } catch (error) {
      console.error('Error adding contact:', error);
    }

    // Also open/select the chat, even if there's no message history yet
    const contactExists = contacts.find((c) => c.id === userToAdd.id);
    if (contactExists) {
      setSelectedContact(contactExists);
    } else {
      const newContact = {
        id: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
        lastMessage: 'No messages yet',
        unread: 0,
        status: userToAdd.status,
        lastActive: userToAdd.lastActive,
        avatarUrl: userToAdd.avatarUrl,
      };
      setContacts([...contacts, newContact]);
      setSelectedContact(newContact);
    }
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };

  // Add a person from the "All Chats" list into saved Contacts
  const handleAddToContactsFromChat = async (e, person) => {
    e.stopPropagation();
    try {
      const added = await addContactApi(person.id);
      setSavedContacts((prev) => (prev.some((c) => c.id === added.id) ? prev : [added, ...prev]));
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  // Remove a person from saved Contacts (does not affect chat/message history)
  const handleRemoveSavedContact = async (e, contactId) => {
    e.stopPropagation();
    try {
      await removeContactApi(contactId);
      setSavedContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (error) {
      console.error('Error removing contact:', error);
    }
  };

  const selectedEffectiveStatus = selectedContact
    ? getEffectiveStatus(selectedContact.status, selectedContact.lastActive)
    : null;

  return (
    <div className="chat-app">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <div className="user-profile">
              <div className="avatar-wrapper">
                <Avatar name={user.name} avatarUrl={user.avatarUrl} className="avatar" />
                <StatusDot status={myStatus} />
              </div>
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className={`user-status user-status-${myStatus}`}>{STATUS_LABELS[myStatus]}</div>
              </div>
            </div>
            <div className="sidebar-header-actions">
              <button onClick={() => setShowSettings(true)} className="sidebar-sign-out" title="Profile Settings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              <button onClick={onSignOut} className="sidebar-sign-out" title="Sign Out">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          {showSettings && (
            <ProfileSettingsModal
              user={user}
              onClose={() => setShowSettings(false)}
              onUpdateUser={onUpdateUser}
            />
          )}

          <div className="contacts-section">
            {/* Search Input */}
            <div className="search-container">
              <div className="search-input-wrapper">
                <span className="search-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="search-input"
                />
              </div>
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
                    <Avatar name={result.name} avatarUrl={result.avatarUrl} className="contact-avatar" />
                    <div className="contact-info">
                      <div className="contact-name">{result.name}</div>
                    </div>
                    <div className="add-contact-icon">+</div>
                  </div>
                ))}
              </div>
            )}

            <div className="contacts-list">
              {/* Saved Contacts */}
              <div className="contacts-group">
                <ContactsGroupHeader
                  title="Contacts"
                  isOpen={isContactsOpen}
                  onToggle={() => setIsContactsOpen((open) => !open)}
                />
                {isContactsOpen && (
                  savedContacts.length === 0 ? (
                    <div className="no-contacts">
                      <p>No contacts yet</p>
                      <p className="no-contacts-hint">Search above, or add someone from All Chats</p>
                    </div>
                  ) : (
                    savedContacts.map((saved) => {
                      const chat = contacts.find((c) => c.id === saved.id);
                      const person = chat ? { ...saved, ...chat } : { ...saved, lastMessage: 'No messages yet', unread: 0 };
                      return (
                        <ContactRow
                          key={saved.id}
                          person={person}
                          isActive={selectedContact?.id === saved.id}
                          isSaved
                          onSelect={setSelectedContact}
                          onRemove={handleRemoveSavedContact}
                          removeTitle="Remove from contacts"
                        />
                      );
                    })
                  )
                )}
              </div>

              {/* All Chats (people you've exchanged messages with) */}
              <div className="contacts-group">
                <ContactsGroupHeader
                  title="All Chats"
                  isOpen={isChatsOpen}
                  onToggle={() => setIsChatsOpen((open) => !open)}
                />
                {isChatsOpen && (
                  contacts.length === 0 ? (
                    <div className="no-contacts">
                      <p>No chats yet</p>
                      <p className="no-contacts-hint">Chats will appear here once you start messaging</p>
                    </div>
                  ) : (
                    contacts.map((chat) => (
                      <ContactRow
                        key={chat.id}
                        person={chat}
                        isActive={selectedContact?.id === chat.id}
                        isSaved={savedContacts.some((c) => c.id === chat.id)}
                        onSelect={setSelectedContact}
                        onAddToContacts={handleAddToContactsFromChat}
                        onRemove={handleRemoveContact}
                        removeTitle="Remove from chats"
                      />
                    ))
                  )
                )}
              </div>
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
                  <div className="avatar-wrapper">
                    <Avatar name={selectedContact.name} avatarUrl={selectedContact.avatarUrl} className="chat-avatar" />
                    <StatusDot status={selectedEffectiveStatus} />
                  </div>
                  <div>
                    <div className="chat-contact-name">{selectedContact.name}</div>
                    <div className={`chat-contact-status chat-contact-status-${selectedEffectiveStatus}`}>
                      {isContactTyping ? 'Typing...' : STATUS_LABELS[selectedEffectiveStatus]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="messages-container">
                {isLoadingMessages ? (
                  <div className="no-messages">
                    <div className="empty-state-icon"><ChatBubbleIcon size={24} /></div>
                    <p>Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="empty-state-icon"><ChatBubbleIcon size={24} /></div>
                    <p>No messages yet</p>
                    <p className="no-messages-hint">Start the conversation by sending a message!</p>
                  </div>
                ) : (
                  <>
                    {hasMoreMessages && (
                      <button
                        type="button"
                        className="load-older-btn"
                        onClick={loadOlderMessages}
                        disabled={isLoadingOlderMessages}
                      >
                        {isLoadingOlderMessages ? 'Loading...' : 'Load earlier messages'}
                      </button>
                    )}
                    {messages.map((message) => (
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
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="message-input-container">
                <form onSubmit={handleSendMessage} className="message-form">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleMessageInputChange}
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
              <div className="empty-state-icon"><ChatBubbleIcon size={30} /></div>
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
