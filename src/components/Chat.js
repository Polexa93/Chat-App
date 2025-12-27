import { useState, useRef, useEffect } from 'react';
import './Chat.css';
import { searchUsers } from '../services/userService';

function Chat({ user, onSignOut }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: messages.length + 1,
      text: newMessage,
      sender: user.id,
      senderName: user.name,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, message]);
    setNewMessage('');
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
                      <div className="contact-last-message">{result.email}</div>
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
                    className={`contact-item ${selectedContact?.id === contact.id ? 'active' : ''}`}
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
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="no-messages-icon">💬</div>
                    <p>No messages yet</p>
                    <p className="no-messages-hint">Start the conversation by sending a message!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${message.sender === user.id ? 'sent' : message.sender === 'system' ? 'system' : 'received'}`}
                    >
                      {message.sender !== 'system' && message.sender !== user.id && (
                        <div className="message-avatar">{message.senderName?.charAt(0).toUpperCase() || 'U'}</div>
                      )}
                      <div className="message-content">
                        {message.sender !== 'system' && message.sender !== user.id && (
                          <div className="message-sender">{message.senderName}</div>
                        )}
                        <div className="message-text">{message.text}</div>
                        <div className="message-time">{formatTime(message.timestamp)}</div>
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

