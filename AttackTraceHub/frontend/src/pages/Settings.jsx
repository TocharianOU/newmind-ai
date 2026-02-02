import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Settings.css';

const Settings = () => {
  const { user, checkAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile settings
  const [profileData, setProfileData] = useState({
    username: '',
    picture: '',
    team: ''
  });

  // Theme context
  const { theme, setTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  
  // Preferences
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: language,
    notifications: true,
    emailNotifications: true
  });

  // Sync theme from context to preferences
  useEffect(() => {
    setPreferences(prev => ({
      ...prev,
      theme: theme
    }));
  }, [theme]);

  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        picture: user.picture || '',
        team: user.team || ''
      });
    }
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/api/v1/user/preferences');
      if (response.data.status === 'success') {
        const fetchedPrefs = response.data.data;
        setPreferences(fetchedPrefs);
        // Sync theme from server to context if different
        if (fetchedPrefs.theme && fetchedPrefs.theme !== theme) {
          setTheme(fetchedPrefs.theme);
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.put('/api/v1/user/settings', profileData);
      if (response.data.status === 'success') {
        setMessage({ type: 'success', text: t('settings.profileUpdateSuccess', 'Profile updated successfully!') });
        await checkAuth(); // Refresh user data
      } else {
        setMessage({
          type: 'error',
          text: response.data.error || t('settings.profileUpdateError', 'Failed to update profile')
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || t('settings.profileUpdateError', 'Failed to update profile')
      });
    } finally {
      setLoading(false);
    }
  };


  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handlePreferenceChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'theme') {
      setTheme(value);
    }
    
    const newPreferences = {
      ...preferences,
      [name]: type === 'checkbox' ? checked : value
    };
    
    setPreferences(newPreferences);
  };

  const handlePreferencesSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Save preferences to backend
      await api.put('/api/v1/user/preferences', preferences);
      setMessage({ type: 'success', text: t('settings.preferencesUpdateSuccess', 'Preferences saved successfully!') });
      
      // Apply language change if language was changed
      if (preferences.language !== language) {
        changeLanguage(preferences.language);
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Give time for success message to show
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: t('settings.preferencesUpdateError', 'Failed to save preferences') });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="settings">
      <div className="settings-header">
        <h1>{t('settings.title', 'Settings')}</h1>
        <p className="subtitle">{t('settings.subtitle', 'Manage your account settings and preferences')}</p>
      </div>

      <div className="settings-container">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('settings.profile', 'Profile')}
          </button>
          <button
            className={activeTab === 'preferences' ? 'active' : ''}
            onClick={() => setActiveTab('preferences')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('settings.preferences', 'Preferences')}
          </button>
          <button
            className={activeTab === 'account' ? 'active' : ''}
            onClick={() => setActiveTab('account')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('settings.account', 'Account')}
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {message.text && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="settings-form">
              <h2>{t('settings.profileInfo', 'Profile Information')}</h2>
              
              <div className="form-group">
                <label htmlFor="username">{t('settings.usernameLabel', 'Username')}</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={profileData.username}
                  onChange={handleProfileChange}
                  required
                  placeholder={t('settings.usernamePlaceholder', 'Your username')}
                />
                <span className="form-hint">{t('settings.usernameHint', "This is how you'll appear in the app")}</span>
              </div>

              <div className="form-group">
                <label htmlFor="email">{t('settings.emailLabel', 'Email')}</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="disabled"
                />
                <span className="form-hint">{t('settings.emailHint', 'Email cannot be changed')}</span>
              </div>

              <div className="form-group">
                <label htmlFor="picture">{t('settings.profilePictureLabel', 'Profile Picture URL')}</label>
                <input
                  type="url"
                  id="picture"
                  name="picture"
                  value={profileData.picture}
                  onChange={handleProfileChange}
                  placeholder={t('settings.profilePicturePlaceholder', 'https://example.com/avatar.jpg')}
                />
                <span className="form-hint">{t('settings.profilePictureHint', 'Optional: URL to your profile picture')}</span>
              </div>

              <div className="form-group">
                <label htmlFor="team">{t('settings.teamLabel', 'Team')}</label>
                <input
                  type="text"
                  id="team"
                  name="team"
                  value={profileData.team}
                  onChange={handleProfileChange}
                  placeholder={t('settings.teamPlaceholder', 'Your team name')}
                />
                <span className="form-hint">{t('settings.teamHint', 'Optional: Your team or organization')}</span>
              </div>

              <button type="submit" className="save-button" disabled={loading}>
                {loading ? t('common.savingChanges', 'Saving...') : t('common.saveChanges', 'Save Changes')}
              </button>
            </form>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <form onSubmit={handlePreferencesSubmit} className="settings-form">
              <h2>{t('settings.preferences', 'Preferences')}</h2>

              <div className="form-group">
                <label htmlFor="theme">{t('settings.theme', 'Theme')}</label>
                <select
                  id="theme"
                  name="theme"
                  value={preferences.theme}
                  onChange={handlePreferenceChange}
                >
                  <option value="light">{t('settings.themeLight', 'Light')}</option>
                  <option value="dark">{t('settings.themeDark', 'Dark')}</option>
                  <option value="auto">{t('settings.themeAuto', 'Auto (System)')}</option>
                </select>
                <span className="form-hint">{t('settings.themeHint', 'Choose your preferred color theme')}</span>
              </div>

              <div className="form-group">
                <label htmlFor="language">{t('settings.language', 'Language')}</label>
                <select
                  id="language"
                  name="language"
                  value={preferences.language}
                  onChange={handlePreferenceChange}
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>
                <span className="form-hint">{t('settings.languageHint', 'Select your preferred language')}</span>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="notifications"
                    checked={preferences.notifications}
                    onChange={handlePreferenceChange}
                  />
                  <span>{t('settings.enableNotifications', 'Enable notifications')}</span>
                </label>
                <span className="form-hint">{t('settings.inAppNotificationsHint', 'Receive in-app notifications')}</span>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="emailNotifications"
                    checked={preferences.emailNotifications}
                    onChange={handlePreferenceChange}
                  />
                  <span>{t('settings.emailNotifications', 'Enable email notifications')}</span>
                </label>
                <span className="form-hint">{t('settings.emailNotificationsHint', 'Receive important updates via email')}</span>
              </div>

              <button type="submit" className="save-button" disabled={loading}>
                {loading ? t('common.savingChanges', 'Saving...') : t('common.savePreferences', 'Save Preferences')}
              </button>
            </form>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="settings-form">
              <h2>{t('settings.accountInfo', 'Account Information')}</h2>
              
              <div className="info-card">
                <div className="info-row">
                  <span className="info-label">{t('settings.planLabel', 'Plan')}</span>
                  <span className="info-value plan-badge">
                    {user?.subscription?.PlanName || 'BASE'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{t('settings.accountStatus', 'Account Status')}</span>
                  <span className="info-value status-active">{t('settings.accountStatusActive', 'Active')}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{t('settings.memberSince', 'Member Since')}</span>
                  <span className="info-value">
                    {user?.subscription?.StartDate 
                      ? new Date(user.subscription.StartDate).toLocaleDateString()
                      : t('common.notAvailable', 'N/A')}
                  </span>
                </div>
              </div>

              <div className="danger-zone">
                <h3>{t('settings.dangerZone', 'Danger Zone')}</h3>
                <p>{t('settings.dangerZoneDesc', 'Irreversible actions that affect your account')}</p>
                <button className="danger-button" type="button">
                  {t('settings.deleteAccount', 'Delete Account')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
