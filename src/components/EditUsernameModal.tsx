import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import PopupWindow from './PopupWindow';
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
      // Call API to update username
      const response = await fetch('http://localhost:3000/api/v1/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('oapToken')}`
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
    <PopupWindow
      title={t('system.editUsername') || 'Edit Username'}
      onClose={onClose}
    >
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
