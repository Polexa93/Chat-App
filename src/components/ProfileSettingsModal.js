import { useRef, useState } from 'react';
import Avatar from './Avatar';
import { updateProfile, updateAvatar } from '../services/authService';
import { fileToAvatarDataUrl } from '../utils/image';

function ProfileSettingsModal({ user, onClose, onUpdateUser }) {
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setError('');
    setSuccess('');
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
      const updatedUser = await updateAvatar(dataUrl);
      onUpdateUser(updatedUser);
      setSuccess('Avatar updated!');
    } catch (err) {
      setError(err.message || 'Failed to update avatar');
      setAvatarPreview(user.avatarUrl || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user.name) return;

    setError('');
    setSuccess('');
    setIsSavingName(true);
    try {
      const updatedUser = await updateProfile(name.trim());
      onUpdateUser(updatedUser);
      setSuccess('Name updated!');
    } catch (err) {
      setError(err.message || 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {error && <div className="message error-message">{error}</div>}
        {success && <div className="message success-message">{success}</div>}

        <div className="modal-avatar-section">
          <button
            type="button"
            className="modal-avatar-button"
            onClick={handleAvatarClick}
            disabled={isUploadingAvatar}
            title="Change avatar"
          >
            <Avatar name={name} avatarUrl={avatarPreview} className="modal-avatar" />
            <span className="modal-avatar-overlay">
              {isUploadingAvatar ? '...' : 'Change'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        <form onSubmit={handleNameSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="profile-name">Name</label>
            <input
              type="text"
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
            />
          </div>
          <button
            type="submit"
            className="submit-button"
            disabled={isSavingName || !name.trim() || name.trim() === user.name}
          >
            {isSavingName ? 'Saving...' : 'Save Name'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSettingsModal;
