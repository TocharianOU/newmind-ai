import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import PopupWindow from './PopupWindow';
import { oapGetToken } from '../ipc/oap';
import { ENV_CONFIG } from '../config/env';
import '@/styles/components/_EditUsernameModal.scss';

interface EditUsernameModalProps {
  currentUsername: string;
  onClose: () => void;
  onSuccess: (newUsername: string) => void;
}

const EditUsernameModal: React.FC<EditUsernameModalProps> = ({ 
  currentUsername, 
  onClose, 
  onSuccess 
}) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState(currentUsername);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (username === currentUsername) {
      setError('Please enter a different username');
      return;
    }

    setLoading(true);

    try {
      // Get token from Electron main process
      const token = await oapGetToken();
      
      // Call API to update username
      const response = await fetch(`${ENV_CONFIG.API_BASE_URL}/api/v1/user/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(username);
        onClose();
      } else {
        setError(data.error || 'Failed to update username');
      }
    } catch (err) {
      console.error('Error updating username:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupWindow onClickOutside={onClose}>
      <div className="modal-header">
        <h2>{t('system.editUsername') || 'Edit Username'}</h2>
        <Button type="button" color="gray" onClick={onClose}>
          &times;
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="edit-username-form">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="username">
            {t('system.username') || 'Username'}
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('system.usernamePlaceholder') || 'Enter your username'}
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="form-actions">
          <Button
            type="button"
            color="gray"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            type="submit"
            color="blue"
            loading={loading}
            disabled={loading}
          >
            {t('common.save') || 'Save'}
          </Button>
        </div>
      </form>
    </PopupWindow>
  );
};

export default EditUsernameModal;
