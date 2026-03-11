import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './AdminModels.css';

const PROVIDERS = [
  { value: 'openai_compatible', label: 'OpenAI-Compatible' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

const EMPTY_FORM = {
  name: '',
  modelId: '',
  provider: 'openai_compatible',
  baseURL: '',
  apiKey: '',
  notes: '',
  active: true,
};

const AdminModels = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchModels();
  }, [user]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/admin/custom-models');
      if (res.data?.status === 'success') {
        setModels(res.data.data || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load custom models' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowApiKey(false);
    setMessage({ type: '', text: '' });
    setShowForm(true);
  };

  const openEdit = (model) => {
    setEditingId(model.id);
    setForm({
      name: model.name,
      modelId: model.modelId,
      provider: model.provider,
      baseURL: model.baseURL,
      apiKey: model.apiKey || '',
      notes: model.notes || '',
      active: model.active,
    });
    setShowApiKey(false);
    setMessage({ type: '', text: '' });
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      if (editingId) {
        await api.put(`/api/v1/admin/custom-models/${editingId}`, form);
        setMessage({ type: 'success', text: 'Model updated successfully' });
      } else {
        await api.post('/api/v1/admin/custom-models', form);
        setMessage({ type: 'success', text: 'Model created successfully' });
      }
      setShowForm(false);
      fetchModels();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Delete custom model "${model.name}" (${model.modelId})?`)) return;
    setDeleting(model.id);
    setMessage({ type: '', text: '' });
    try {
      await api.delete(`/api/v1/admin/custom-models/${model.id}`);
      setMessage({ type: 'success', text: `Model "${model.name}" deleted` });
      fetchModels();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Delete failed' });
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (model) => {
    try {
      await api.put(`/api/v1/admin/custom-models/${model.id}`, { active: !model.active });
      fetchModels();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const providerLabel = (val) => PROVIDERS.find(p => p.value === val)?.label || val;

  if (loading && models.length === 0) {
    return (
      <div className="amodels-loading">
        <div className="spinner" />
        <p>Loading custom models...</p>
      </div>
    );
  }

  return (
    <div className="amodels-page">
      <div className="amodels-header">
        <div>
          <h1>Custom Model Providers</h1>
          <p className="amodels-subtitle">
            Add external model endpoints to the platform model list. Active models are available in the chat interface.
          </p>
        </div>
        <button className="amodels-btn amodels-btn-primary" onClick={openCreate}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
            <path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Model
        </button>
      </div>

      {message.text && (
        <div className={`amodels-message ${message.type === 'error' ? 'amodels-message-error' : 'amodels-message-success'}`}>
          {message.text}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="amodels-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="amodels-modal" onClick={e => e.stopPropagation()}>
            <div className="amodels-modal-header">
              <h2>{editingId ? 'Edit Model' : 'Add Custom Model'}</h2>
              <button className="amodels-modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            {message.text && showForm && (
              <div className={`amodels-message ${message.type === 'error' ? 'amodels-message-error' : 'amodels-message-success'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="amodels-form">
              <div className="amodels-form-row">
                <label>Display Name <span className="required">*</span></label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. GPT-4o (OpenAI)"
                  required
                />
              </div>

              <div className="amodels-form-row">
                <label>Model ID <span className="required">*</span></label>
                <input
                  name="modelId"
                  value={form.modelId}
                  onChange={handleFormChange}
                  placeholder="e.g. gpt-4o  or  deepseek-chat"
                  required
                  disabled={!!editingId}
                />
                <span className="amodels-hint">Unique identifier used in API calls. Cannot be changed after creation.</span>
              </div>

              <div className="amodels-form-row">
                <label>Provider Type <span className="required">*</span></label>
                <select name="provider" value={form.provider} onChange={handleFormChange}>
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <span className="amodels-hint">
                  OpenAI-Compatible: uses <code>/chat/completions</code> endpoint. Anthropic: uses <code>/messages</code>.
                </span>
              </div>

              <div className="amodels-form-row">
                <label>Base URL <span className="required">*</span></label>
                <input
                  name="baseURL"
                  value={form.baseURL}
                  onChange={handleFormChange}
                  placeholder="https://api.openai.com/v1"
                  required
                />
              </div>

              <div className="amodels-form-row">
                <label>API Key</label>
                <div className="amodels-apikey-row">
                  <input
                    name="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={handleFormChange}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="amodels-btn-icon"
                    onClick={() => setShowApiKey(v => !v)}
                    title={showApiKey ? 'Hide' : 'Show'}
                  >
                    {showApiKey ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                        <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="amodels-form-row">
                <label>Notes</label>
                <input
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Optional description"
                />
              </div>

              <div className="amodels-form-row amodels-form-row-inline">
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active}
                    onChange={handleFormChange}
                  />
                  Active (visible in model list)
                </label>
              </div>

              <div className="amodels-form-actions">
                <button type="button" className="amodels-btn amodels-btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="amodels-btn amodels-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingId ? 'Update Model' : 'Create Model')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Model list */}
      {models.length === 0 ? (
        <div className="amodels-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
            <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>No custom models yet</p>
          <p className="amodels-empty-sub">Add an external model endpoint to make it available in the chat model selector.</p>
        </div>
      ) : (
        <div className="amodels-table-wrap">
          <table className="amodels-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Model ID</th>
                <th>Provider</th>
                <th>Base URL</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={model.id} className={model.active ? '' : 'amodels-row-inactive'}>
                  <td>
                    <div className="amodels-model-name">{model.name}</div>
                    {model.notes && <div className="amodels-model-notes">{model.notes}</div>}
                  </td>
                  <td><code className="amodels-model-id">{model.modelId}</code></td>
                  <td><span className="amodels-provider-badge">{providerLabel(model.provider)}</span></td>
                  <td>
                    <span className="amodels-url" title={model.baseURL}>
                      {model.baseURL.length > 40 ? model.baseURL.slice(0, 37) + '…' : model.baseURL}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`amodels-toggle ${model.active ? 'amodels-toggle-active' : 'amodels-toggle-inactive'}`}
                      onClick={() => toggleActive(model)}
                      title={model.active ? 'Disable' : 'Enable'}
                    >
                      {model.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="amodels-action-btns">
                      <button
                        className="amodels-btn amodels-btn-sm amodels-btn-secondary"
                        onClick={() => openEdit(model)}
                      >
                        Edit
                      </button>
                      <button
                        className="amodels-btn amodels-btn-sm amodels-btn-danger"
                        onClick={() => handleDelete(model)}
                        disabled={deleting === model.id}
                      >
                        {deleting === model.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="amodels-footer-note">
        <strong>Note:</strong> Custom models are proxied via the Hub backend. The API key is stored server-side and never exposed to clients.
        In Enterprise mode, custom models are available to all users. In SaaS mode, only admins can use them.
      </div>
    </div>
  );
};

export default AdminModels;
