/**
 * 组织连接（Integrations）
 * 三个页签：
 *   我的连接    —— 已启用的连接器、状态、工具级开关
 *   连接市场    —— 浏览全部可用连接器并配置启用
 *   自定义 MCP  —— 用户自建的 MCP 连接，支持新建 / 编辑 / 启停 / 导入存量配置
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../config/api';
import './Integrations.css';

// 后端来源，用于把 /integrations/mysql/logo-48.svg 之类的相对路径补全
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || '';

function logoSrc(logo) {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  return `${API_ORIGIN}${logo}`;
}

// ── 多认证方式的字段分组 ──────────────────────────────────────────────────────
const AUTH_FIELD_SETS = {
  elasticsearch: {
    apiKey: ['ES_API_KEY'],
    basic: ['ES_USERNAME', 'ES_PASSWORD'],
  },
  kibana: {
    apiKey: ['KIBANA_API_KEY'],
    basic: ['KIBANA_USERNAME', 'KIBANA_PASSWORD'],
    cookies: ['KIBANA_COOKIES'],
  },
};

const AUTH_MODE_LABELS = {
  apiKey: 'API Key',
  basic: '用户名 / 密码',
  cookies: 'Cookies',
};

function authProfileForIntegration(integration) {
  const name = integration?.name || '';
  if (/elastic/i.test(name)) return AUTH_FIELD_SETS.elasticsearch;
  if (/kibana/i.test(name)) return AUTH_FIELD_SETS.kibana;
  return null;
}

function initialAuthMode(profile, values) {
  if (!profile) return 'apiKey';
  if (profile.basic?.some(key => values[key])) return 'basic';
  if (profile.cookies?.some(key => values[key])) return 'cookies';
  return profile.apiKey ? 'apiKey' : Object.keys(profile)[0];
}

function isAuthField(profile, key) {
  return Object.values(profile || {}).some(fields => fields.includes(key));
}

// ── 自定义 MCP ───────────────────────────────────────────────────────────────
// 表单里可选的连接方式。
// 注意：这里刻意不提供 stdio（本地命令）方式 —— stdio 需要对应的可执行文件预先装在
// 服务端容器里，用户自己填写的命令在容器内并不存在，跑起来必然失败，因此不开放。
// 但通过「导入已有配置」进来的历史条目仍可能是 stdio 类型，列表卡片需要正常展示它们，
// 只是不允许在线编辑（见 openCustomModal）。
const TRANSPORT_OPTIONS = [
  { value: 'streamable', label: 'Streamable HTTP' },
  { value: 'sse',        label: 'SSE' },
  { value: 'websocket',  label: 'WebSocket' },
];

// 展示用标签，额外包含只读展示的 stdio
const TRANSPORT_LABELS = {
  ...TRANSPORT_OPTIONS.reduce((m, o) => { m[o.value] = o.label; return m; }, {}),
  stdio: '本地命令（stdio）',
};

// stdio 用命令，其他方式用 URL
function isStdio(transport) {
  return transport === 'stdio';
}

// 列表里展示的「地址或命令」
function customEndpointText(item) {
  if (isStdio(item?.transport)) {
    const args = Array.isArray(item?.args) ? item.args : [];
    return [item?.command || '', ...args].filter(Boolean).join(' ');
  }
  return item?.url || '';
}

// ── 自定义 MCP 的认证方式预设 ───────────────────────────────────────────────
const MCP_AUTH_OPTIONS = [
  { value: 'none',   label: '无认证' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'header', label: '自定义请求头' },
  { value: 'basic',  label: '用户名密码' },
];

// 卡片上展示的认证方式标签
const MCP_AUTH_TAGS = {
  none:   '无认证',
  bearer: 'Bearer 令牌',
  header: '自定义请求头',
  basic:  'Basic 认证',
};

// ── 工具函数 ─────────────────────────────────────────────────────────────────
function getUniqueTags(integrations) {
  const tags = new Set();
  integrations.forEach(i => (i.tags || []).forEach(t => tags.add(t)));
  return ['全部', ...Array.from(tags).sort()];
}

// ── 极简 Markdown 渲染（不引入额外依赖）─────────────────────────────────────
function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="ig-code">$1</code>');
}

function MarkdownDoc({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let listBuf = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="ig-doc-ul">
        {listBuf.map((li, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: li }} />
        ))}
      </ul>
    );
    listBuf = [];
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('## ')) {
      flushList();
      nodes.push(<h3 key={idx} className="ig-doc-h2">{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      flushList();
      nodes.push(<h2 key={idx} className="ig-doc-h1">{line.slice(2)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList();
      nodes.push(<h4 key={idx} className="ig-doc-h3">{line.slice(4)}</h4>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuf.push(inlineFormat(line.slice(2)));
    } else if (/^\d+\. /.test(line)) {
      flushList();
      nodes.push(<p key={idx} className="ig-doc-step" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      nodes.push(<p key={idx} className="ig-doc-p" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    }
  });
  flushList();
  return <div className="ig-doc">{nodes}</div>;
}

// ── 图标 ─────────────────────────────────────────────────────────────────────
const IconEyeOn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// ── 配置弹窗（两个页签共用）─────────────────────────────────────────────────
function ConfigModal({ integration, mode, onSave, onTest, onClose, saving, testing, msg }) {
  const [values, setValues] = useState({});
  const [authMode, setAuthMode] = useState('apiKey');
  const [showPw, setShowPw] = useState({});

  useEffect(() => {
    if (!integration) return;
    const defs = {};
    const saved = integration.tenant?.config || {};
    const schema = integration.configSchema;
    if (schema?.properties) {
      Object.entries(schema.properties).forEach(([k, v]) => {
        defs[k] = saved[k] !== undefined ? String(saved[k]) : (v.default !== undefined ? String(v.default) : '');
      });
    }
    setValues(defs);
    setAuthMode(initialAuthMode(authProfileForIntegration(integration), defs));
    setShowPw({});
  }, [integration]);

  if (!integration) return null;
  const schema = integration.configSchema;
  const authProfile = authProfileForIntegration(integration);

  const visibleProperties = schema?.properties
    ? Object.entries(schema.properties).filter(([key]) => {
        if (!authProfile) return true;
        if (isAuthField(authProfile, key)) return authProfile[authMode]?.includes(key);
        return true;
      })
    : [];

  // 只提交当前认证方式相关的字段
  const normalizedValues = () => {
    const next = { ...values };
    if (authProfile) {
      Object.entries(authProfile).forEach(([modeKey, fields]) => {
        if (modeKey === authMode) return;
        fields.forEach(field => delete next[field]);
      });
    }
    return next;
  };

  return (
    <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ig-modal">
        <div className="ig-modal-hd">
          {integration.logo && (
            <img src={logoSrc(integration.logo)} alt="" width="32" height="32" className="ig-modal-logo" />
          )}
          <div>
            <div className="ig-modal-title">{integration.name}</div>
            <div className="ig-modal-sub">
              {mode === 'enable' ? '配置并启用' : '更新配置'}
            </div>
          </div>
          <button className="ig-modal-x" onClick={onClose} title="关闭">
            <IconClose />
          </button>
        </div>

        <div className="ig-modal-body">
          {authProfile && (
            <div className="ig-field">
              <label className="ig-field-lbl">认证方式</label>
              <div className="ig-auth-choice">
                {Object.keys(authProfile).map(modeKey => (
                  <button
                    key={modeKey}
                    type="button"
                    className={`ig-auth-option${authMode === modeKey ? ' active' : ''}`}
                    onClick={() => setAuthMode(modeKey)}
                  >
                    {AUTH_MODE_LABELS[modeKey] || modeKey}
                  </button>
                ))}
              </div>
              <p className="ig-field-hint">
                只能选择一种认证方式，保存时仅提交所选方式对应的字段。
              </p>
            </div>
          )}

          {schema?.properties
            ? visibleProperties.map(([key, f]) => {
                if (f.format === 'file') return null;
                const isEnum      = Array.isArray(f.enum);
                const isSensitive = f.sensitive === true;
                const required    = schema.required?.includes(key)
                  || (authProfile && authProfile[authMode]?.includes(key));
                return (
                  <div key={key} className="ig-field">
                    <label className="ig-field-lbl">
                      {f.title || key}
                      {required && <span className="ig-req">*</span>}
                    </label>
                    {f.description && <p className="ig-field-hint">{f.description}</p>}
                    {isEnum ? (
                      <select
                        className="ig-input"
                        value={values[key] ?? (f.default || '')}
                        onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                      >
                        {f.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <div className="ig-input-wrap">
                        <input
                          className="ig-input"
                          type={isSensitive && !showPw[key] ? 'password' : 'text'}
                          value={values[key] ?? ''}
                          placeholder={f.placeholder ?? ''}
                          onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                        />
                        {isSensitive && (
                          <button
                            type="button"
                            className="ig-pw-eye"
                            title={showPw[key] ? '隐藏' : '显示'}
                            onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                          >
                            {showPw[key] ? <IconEyeOn /> : <IconEyeOff />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            : <p className="ig-no-config">该连接无需额外配置。</p>
          }

          {msg.text && (
            <div className={`ig-msg ${msg.type}`}>{msg.text}</div>
          )}
        </div>

        <div className="ig-modal-ft">
          <button className="ig-btn-ghost" onClick={() => onTest(normalizedValues())} disabled={saving || testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button className="ig-btn-primary" onClick={() => onSave(normalizedValues())} disabled={saving || testing}>
            {saving ? '保存中…' : (mode === 'enable' ? '启用连接' : '保存修改')}
          </button>
          <button className="ig-btn-ghost" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ── 详情弹窗 ─────────────────────────────────────────────────────────────────
function DetailModal({ integration: int, onClose, onEnable, onConfigure, onDisable }) {
  if (!int) return null;
  const isEnabled = int.tenant?.enabled;
  const tags = Array.isArray(int.tags) ? int.tags : [];

  return (
    <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ig-detail-modal">
        <div className="ig-detail-hd">
          <div className="ig-detail-logo-wrap">
            {int.logo
              ? <img src={logoSrc(int.logo)} alt={int.name} width="48" height="48" className="ig-detail-logo" />
              : <span className="ig-detail-logo-fb">{int.name.charAt(0)}</span>}
          </div>
          <div className="ig-detail-meta">
            <div className="ig-detail-name">{int.name}</div>
            <div className="ig-detail-tags">
              {tags.map(tag => <span key={tag} className="ig-tag">{tag}</span>)}
            </div>
          </div>
          <div className="ig-detail-actions-hd">
            {isEnabled ? (
              <>
                <button className="ig-btn-ghost sm" onClick={() => { onConfigure(); onClose(); }}>配置</button>
                <button className="ig-btn-danger sm" onClick={() => { onDisable(); onClose(); }}>禁用</button>
              </>
            ) : (
              <button className="ig-btn-primary sm" onClick={() => { onEnable(); onClose(); }}>添加</button>
            )}
          </div>
          <button className="ig-modal-x" onClick={onClose} title="关闭">
            <IconClose />
          </button>
        </div>

        <div className="ig-detail-body">
          <p className="ig-detail-desc">{int.description}</p>

          {int.document && (
            <div className="ig-detail-doc">
              <MarkdownDoc text={int.document} />
            </div>
          )}

          {int.configSchema?.properties && (
            <div className="ig-detail-schema">
              <h3 className="ig-doc-h2">配置参数</h3>
              <div className="ig-schema-table">
                {Object.entries(int.configSchema.properties).map(([key, f]) => {
                  const required = int.configSchema.required?.includes(key);
                  return (
                    <div key={key} className="ig-schema-row">
                      <div className="ig-schema-key">
                        <code className="ig-code">{key}</code>
                        {required && <span className="ig-req">*</span>}
                      </div>
                      <div className="ig-schema-info">
                        <div className="ig-schema-title">{f.title || key}</div>
                        {f.description && <div className="ig-schema-desc">{f.description}</div>}
                        {f.default !== undefined && (
                          <div className="ig-schema-default">默认值：<code className="ig-code">{String(f.default)}</code></div>
                        )}
                        {f.enum && (
                          <div className="ig-schema-default">
                            可选值：{f.enum.map(o => <code key={o} className="ig-code" style={{ marginRight: 4 }}>{o}</code>)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 市场卡片 ─────────────────────────────────────────────────────────────────
function MarketCard({ integration: int, onEnable, onDetails }) {
  const isEnabled = int.tenant?.enabled;
  const tags      = Array.isArray(int.tags) ? int.tags : [];

  return (
    <div className="ig-card">
      <div className="ig-card-top">
        <div className="ig-card-logo" onClick={onDetails} style={{ cursor: 'pointer' }}>
          {int.logo
            ? <img src={logoSrc(int.logo)} alt={int.name} width="32" height="32"
                onError={e => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
            : null}
          <span className="ig-card-logo-fb" style={{ display: int.logo ? 'none' : undefined }}>
            {int.name.charAt(0)}
          </span>
        </div>
        <div className="ig-card-meta" onClick={onDetails} style={{ cursor: 'pointer' }}>
          <div className="ig-card-name">{int.name}</div>
          <div className="ig-card-tags">
            {tags.map(tag => <span key={tag} className="ig-tag">{tag}</span>)}
          </div>
        </div>
        <div>
          {isEnabled
            ? <span className="ig-badge on">已启用</span>
            : <span className="ig-badge">未启用</span>}
        </div>
      </div>
      <p className="ig-card-desc" onClick={onDetails} style={{ cursor: 'pointer' }}>{int.description}</p>
      <div className="ig-card-actions">
        <button className="ig-btn-primary sm" onClick={onEnable}>
          {isEnabled ? '配置' : '添加'}
        </button>
        <button className="ig-btn-details" onClick={onDetails} title="查看详情">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── 我的连接卡片 ─────────────────────────────────────────────────────────────
function ServerCard({ integration, tools, toolOverrides, onConfigure, onToggleIntegration, onRemove, onDetails, onToggleTool }) {
  const [expanded, setExpanded] = useState(false);
  const isEnabled = !!integration.tenant?.enabled;
  const lastError = integration.tenant?.lastError;
  const toolCount = tools.length;

  let statusEl;
  if (!isEnabled) {
    statusEl = <span className="ig-conn-pending">已禁用 · 配置已保留</span>;
  } else if (lastError) {
    statusEl = <span className="ig-conn-err">连接异常</span>;
  } else {
    statusEl = (
      <span className="ig-conn-ok">
        ● 已启用{toolCount > 0 ? ` · ${toolCount} 个工具` : ''}
      </span>
    );
  }

  return (
    <div className={`ig-server-card${isEnabled && !lastError ? ' live' : ''}${lastError ? ' errored' : ''}`}>
      <div className="ig-server-top clickable" onClick={() => setExpanded(e => !e)}>
        <div className="ig-card-logo sm">
          {integration.logo
            ? <img src={logoSrc(integration.logo)} alt={integration.name} width="28" height="28"
                onError={e => { e.target.style.display = 'none'; }} />
            : <span className="ig-card-logo-fb sm">{integration.name.charAt(0)}</span>}
        </div>
        <div className="ig-server-meta">
          <div className="ig-server-name">{integration.name}</div>
          <div className="ig-server-sub">{statusEl}</div>
        </div>
        <div className="ig-server-actions">
          <button
            type="button"
            className={`ig-integration-toggle-btn${isEnabled ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleIntegration(); }}
            title={isEnabled ? `禁用 ${integration.name}` : `启用 ${integration.name}`}
          >
            <span className="ig-integration-toggle-track">
              <span className="ig-integration-toggle-knob" />
            </span>
          </button>
          <button
            type="button"
            className="ig-expand-btn"
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            title={expanded ? '收起' : '展开'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"
              style={{ transform: expanded ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }}>
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {lastError && <p className="ig-server-err-msg">{lastError}</p>}

      {expanded && (
        <div className="ig-server-panel">
          <div className="ig-server-panel-actions">
            <button className="ig-panel-action" onClick={onDetails}>详情</button>
            <button className="ig-panel-action" onClick={onConfigure}>配置</button>
            <button className="ig-panel-action" onClick={onToggleIntegration}>
              {isEnabled ? '禁用' : '启用'}
            </button>
            <button className="ig-panel-action danger" onClick={onRemove}>彻底移除</button>
          </div>

          {toolCount > 0 ? (
            <div className="ig-tools-list">
              {tools.map(toolName => {
                const key = `${integration.name}:${toolName}`;
                const on = toolOverrides[key] !== false;
                return (
                  <button key={toolName} type="button" className={`ig-tool-row${on ? '' : ' off'}`}
                    onClick={() => onToggleTool(key, on)}>
                    <span className={`ig-tool-toggle${on ? ' on' : ''}`} />
                    <span className="ig-tool-name">{toolName}</span>
                  </button>
                );
              })}
              <p className="ig-tools-hint">
                工具开关保存为当前账号的默认偏好。
              </p>
            </div>
          ) : (
            <div className="ig-tools-empty">暂无工具级配置记录。</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 密码框（带眼睛切换）─────────────────────────────────────────────────────
function SecretInput({ value, placeholder, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ig-input-wrap">
      <input
        className="ig-input"
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete="new-password"
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className="ig-pw-eye"
        title={show ? '隐藏' : '显示'}
        onClick={() => setShow(v => !v)}
      >
        {show ? <IconEyeOn /> : <IconEyeOff />}
      </button>
    </div>
  );
}

// ── 自定义 MCP 表单弹窗 ─────────────────────────────────────────────────────
function CustomMcpModal({ item, onSave, onClose, saving, msg }) {
  const isEdit = !!item?.id;

  const [name, setName]           = useState('');
  const [transport, setTransport] = useState('streamable');
  const [url, setUrl]             = useState('');
  const [enabled, setEnabled]     = useState(true);
  const [localErr, setLocalErr]   = useState('');

  // 认证方式（预设选项，取代过去的手拼请求头）
  const [authType,    setAuthType]    = useState('none');
  const [token,       setToken]       = useState('');
  const [headerName,  setHeaderName]  = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');

  useEffect(() => {
    setName(item?.name || '');
    // 只保留 streamable / sse / websocket，历史的 stdio 不会走到这里
    setTransport(TRANSPORT_OPTIONS.some(o => o.value === item?.transport) ? item.transport : 'streamable');
    setUrl(item?.url || '');
    setEnabled(item?.enabled !== false);
    // 编辑时默认选中原认证方式，但凭据一律留空（后端加密存储，不回显明文）
    setAuthType(MCP_AUTH_OPTIONS.some(o => o.value === item?.authType) ? item.authType : 'none');
    setToken('');
    setHeaderName('');
    setHeaderValue('');
    setUsername('');
    setPassword('');
    setLocalErr('');
  }, [item]);

  // 编辑已有凭据时的输入框提示：必须重新填写
  const secretHint = isEdit && item?.hasCredentials ? '出于安全考虑不回显，请重新填写' : '';

  const submit = () => {
    setLocalErr('');
    const trimmedName = name.trim();
    if (!trimmedName) { setLocalErr('名称不能为空'); return; }

    const u = url.trim();
    if (!u) { setLocalErr('该连接方式必须填写 URL'); return; }
    if (!/^https?:\/\//i.test(u)) { setLocalErr('URL 必须以 http:// 或 https:// 开头'); return; }

    const auth = { type: authType };
    if (authType === 'bearer') {
      if (!token.trim()) { setLocalErr('请填写访问令牌'); return; }
      auth.token = token.trim();
    } else if (authType === 'header') {
      if (!headerName.trim())  { setLocalErr('请填写请求头名称'); return; }
      if (!headerValue.trim()) { setLocalErr('请填写请求头的值'); return; }
      auth.headerName  = headerName.trim();
      auth.headerValue = headerValue.trim();
    } else if (authType === 'basic') {
      if (!username.trim()) { setLocalErr('请填写用户名'); return; }
      if (!password)        { setLocalErr('请填写密码'); return; }
      auth.username = username.trim();
      auth.password = password;
    }

    onSave({ name: trimmedName, transport, url: u, enabled, auth });
  };

  return (
    <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ig-modal">
        <div className="ig-modal-hd">
          <div>
            <div className="ig-modal-title">{isEdit ? '编辑自定义 MCP' : '新建自定义 MCP'}</div>
            <div className="ig-modal-sub">保存后会自动下发到聊天助手</div>
          </div>
          <button className="ig-modal-x" onClick={onClose} title="关闭">
            <IconClose />
          </button>
        </div>

        <div className="ig-modal-body">
          <div className="ig-field">
            <label className="ig-field-lbl">名称<span className="ig-req">*</span></label>
            <p className="ig-field-hint">在聊天助手里显示的连接名，组织内需唯一。</p>
            <input
              className="ig-input"
              type="text"
              value={name}
              placeholder="例如：my-mcp-server"
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="ig-field">
            <label className="ig-field-lbl">连接方式<span className="ig-req">*</span></label>
            <p className="ig-field-hint">
              只支持远程服务方式；本地命令（stdio）需要可执行文件预装在服务端容器内，因此不开放。
            </p>
            <select className="ig-input" value={transport} onChange={e => setTransport(e.target.value)}>
              {TRANSPORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="ig-field">
            <label className="ig-field-lbl">服务地址<span className="ig-req">*</span></label>
            <p className="ig-field-hint">必须以 http:// 或 https:// 开头。</p>
            <input
              className="ig-input"
              type="text"
              value={url}
              placeholder="https://example.com/mcp"
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          <div className="ig-field">
            <label className="ig-field-lbl">认证方式</label>
            <p className="ig-field-hint">选择目标服务要求的鉴权方式，凭据会加密保存。</p>
            <select className="ig-input" value={authType} onChange={e => setAuthType(e.target.value)}>
              {MCP_AUTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {authType === 'bearer' && (
            <div className="ig-field">
              <label className="ig-field-lbl">访问令牌<span className="ig-req">*</span></label>
              <p className="ig-field-hint">会以 Authorization: Bearer &lt;令牌&gt; 的形式发送。</p>
              <SecretInput
                value={token}
                placeholder={secretHint || '例如：sk-xxxxxxxx'}
                onChange={setToken}
              />
            </div>
          )}

          {authType === 'header' && (
            <>
              <div className="ig-field">
                <label className="ig-field-lbl">请求头名称<span className="ig-req">*</span></label>
                <input
                  className="ig-input"
                  type="text"
                  value={headerName}
                  placeholder="例如：X-API-Key"
                  onChange={e => setHeaderName(e.target.value)}
                />
              </div>
              <div className="ig-field">
                <label className="ig-field-lbl">请求头的值<span className="ig-req">*</span></label>
                <SecretInput
                  value={headerValue}
                  placeholder={secretHint || '请求头对应的值'}
                  onChange={setHeaderValue}
                />
              </div>
            </>
          )}

          {authType === 'basic' && (
            <>
              <div className="ig-field">
                <label className="ig-field-lbl">用户名<span className="ig-req">*</span></label>
                <input
                  className="ig-input"
                  type="text"
                  value={username}
                  placeholder="登录用户名"
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div className="ig-field">
                <label className="ig-field-lbl">密码<span className="ig-req">*</span></label>
                <SecretInput
                  value={password}
                  placeholder={secretHint || '登录密码'}
                  onChange={setPassword}
                />
              </div>
            </>
          )}

          {isEdit && item?.hasCredentials && authType !== 'none' && (
            <div className="ig-cred-note">
              出于安全考虑不回显已保存的凭据。保存修改时请重新填写上面的凭据字段，留空将无法通过校验。
            </div>
          )}

          <div className="ig-field">
            <label className="ig-field-lbl">启用状态</label>
            <div className="ig-switch-line">
              <button
                type="button"
                className={`ig-integration-toggle-btn${enabled ? ' on' : ''}`}
                onClick={() => setEnabled(v => !v)}
                title={enabled ? '点击禁用' : '点击启用'}
              >
                <span className="ig-integration-toggle-track">
                  <span className="ig-integration-toggle-knob" />
                </span>
              </button>
              <span className="ig-switch-text">{enabled ? '已启用，配置会下发到聊天助手' : '已禁用，配置保留但不下发'}</span>
            </div>
          </div>

          {(localErr || msg.text) && (
            <div className={`ig-msg ${localErr ? 'error' : msg.type}`}>{localErr || msg.text}</div>
          )}
        </div>

        <div className="ig-modal-ft">
          <button className="ig-btn-primary" onClick={submit} disabled={saving}>
            {saving ? '保存中…' : (isEdit ? '保存修改' : '创建')}
          </button>
          <button className="ig-btn-ghost" onClick={onClose} disabled={saving}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ── 导入存量配置弹窗 ────────────────────────────────────────────────────────
function ImportModal({ items, selected, onToggle, onToggleAll, onConfirm, onClose, importing, msg }) {
  const allChecked = items.length > 0 && items.every(i => selected.includes(i.name));

  return (
    <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ig-modal">
        <div className="ig-modal-hd">
          <div>
            <div className="ig-modal-title">导入已有配置</div>
            <div className="ig-modal-sub">
              以下配置来自聊天页「锤子」按钮中手工添加的 MCP，尚未收录到组织连接。
            </div>
          </div>
          <button className="ig-modal-x" onClick={onClose} title="关闭">
            <IconClose />
          </button>
        </div>

        <div className="ig-modal-body">
          <button type="button" className="ig-import-all" onClick={() => onToggleAll(!allChecked)}>
            {allChecked ? '取消全选' : '全选'}（已选 {selected.length} / {items.length}）
          </button>

          <div className="ig-import-list">
            {items.map(item => {
              const checked = selected.includes(item.name);
              return (
                <label key={item.name} className={`ig-import-row${checked ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    className="ig-import-cb"
                    checked={checked}
                    onChange={() => onToggle(item.name)}
                  />
                  <span className="ig-import-meta">
                    <span className="ig-import-name">{item.name}</span>
                    <span className="ig-import-endpoint">{customEndpointText(item) || '—'}</span>
                  </span>
                  <span className="ig-tag">{TRANSPORT_LABELS[item.transport] || item.transport}</span>
                </label>
              );
            })}
          </div>

          {msg.text && <div className={`ig-msg ${msg.type}`}>{msg.text}</div>}
        </div>

        <div className="ig-modal-ft">
          <button
            className="ig-btn-primary"
            onClick={onConfirm}
            disabled={importing || selected.length === 0}
          >
            {importing ? '导入中…' : `导入所选 (${selected.length})`}
          </button>
          <button className="ig-btn-ghost" onClick={onClose} disabled={importing}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ── 自定义 MCP 卡片 ─────────────────────────────────────────────────────────
function CustomMcpCard({ item, onEdit, onToggle, onDelete, busy }) {
  const enabled  = item.enabled !== false;
  const endpoint = customEndpointText(item);
  const stdio    = isStdio(item.transport);
  // 列表接口不再回传凭据明文，只给出 authType / hasCredentials
  const authTag  = MCP_AUTH_TAGS[item.authType] || (item.hasCredentials ? '已配置认证' : null);

  return (
    <div className={`ig-server-card${enabled ? ' live' : ''}`}>
      <div className="ig-server-top">
        <div className="ig-card-logo sm">
          <span className="ig-card-logo-fb sm">{(item.name || '?').charAt(0).toUpperCase()}</span>
        </div>
        <div className="ig-server-meta">
          <div className="ig-server-name">
            {item.name}
            {item.source === 'imported' && <span className="ig-badge ig-src-badge">已导入</span>}
          </div>
          <div className="ig-server-sub">
            {enabled
              ? <span className="ig-conn-ok">● 已启用</span>
              : <span className="ig-conn-pending">已禁用 · 配置已保留</span>}
            <span className="ig-tag ig-transport-tag">{TRANSPORT_LABELS[item.transport] || item.transport}</span>
            {!stdio && authTag && <span className="ig-tag ig-auth-tag">{authTag}</span>}
          </div>
        </div>
        <div className="ig-server-actions">
          <button
            type="button"
            className={`ig-integration-toggle-btn${enabled ? ' on' : ''}`}
            onClick={onToggle}
            disabled={busy}
            title={enabled ? `禁用 ${item.name}` : `启用 ${item.name}`}
          >
            <span className="ig-integration-toggle-track">
              <span className="ig-integration-toggle-knob" />
            </span>
          </button>
        </div>
      </div>

      {endpoint && <div className="ig-custom-endpoint" title={endpoint}>{endpoint}</div>}

      <div className="ig-server-panel-actions">
        <button
          className="ig-panel-action"
          onClick={onEdit}
          disabled={busy}
          title={stdio ? 'stdio 类型的连接不支持在线编辑' : undefined}
        >
          编辑
        </button>
        <button className="ig-panel-action danger" onClick={onDelete} disabled={busy}>删除</button>
      </div>
    </div>
  );
}

// ── 主页面 ───────────────────────────────────────────────────────────────────
const Integrations = () => {
  const [activeTab, setActiveTab] = useState('my-tools');

  const [servers, setServers]                 = useState([]); // /user/mcp/search
  const [tenantIntegrations, setTenantIntegrations] = useState([]); // /tenant-mcp/integrations
  const [toolOverrides, setToolOverrides]     = useState({});
  const [loading, setLoading]                 = useState(false);
  const [pageError, setPageError]             = useState('');

  // 配置弹窗
  const [configModal,   setConfigModal]   = useState(null); // { integration, mode }
  const [configSaving,  setConfigSaving]  = useState(false);
  const [configTesting, setConfigTesting] = useState(false);
  const [configMsg,     setConfigMsg]     = useState({ type: '', text: '' });

  // 彻底移除确认
  const [removeTarget, setRemoveTarget] = useState(null);

  // 详情弹窗
  const [detailTarget, setDetailTarget] = useState(null);

  // 市场筛选
  const [search,    setSearch]    = useState('');
  const [activeTag, setActiveTag] = useState('全部');

  // 自定义 MCP
  const [customs,       setCustoms]       = useState([]);
  const [customModal,   setCustomModal]   = useState(null); // { item }
  const [customSaving,  setCustomSaving]  = useState(false);
  const [customMsg,     setCustomMsg]     = useState({ type: '', text: '' });
  const [customNotice,  setCustomNotice]  = useState({ type: '', text: '' });
  const [customBusyId,  setCustomBusyId]  = useState(null);
  const [customDelTarget, setCustomDelTarget] = useState(null);

  // 导入存量配置
  const [importModal,    setImportModal]    = useState(null); // { items }
  const [importSelected, setImportSelected] = useState([]);
  const [importing,      setImporting]      = useState(false);
  const [importMsg,      setImportMsg]      = useState({ type: '', text: '' });
  const [importLoading,  setImportLoading]  = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [mktRes, tenantRes, overridesRes, customRes] = await Promise.allSettled([
        api.post('/api/v1/user/mcp/search', { search_input: '', filter: 0 }),
        api.get('/api/v1/tenant-mcp/integrations'),
        api.get('/api/v1/tenant-mcp/tool-overrides'),
        api.get('/api/v1/tenant-mcp/custom'),
      ]);

      if (mktRes.status === 'fulfilled') {
        setServers(mktRes.value.data?.data || []);
      } else {
        setPageError('连接器列表加载失败，请稍后重试。');
      }
      if (tenantRes.status === 'fulfilled') {
        setTenantIntegrations(tenantRes.value.data?.data?.integrations || []);
      }
      if (overridesRes.status === 'fulfilled') {
        setToolOverrides(overridesRes.value.data?.data?.overrides || {});
      }
      if (customRes.status === 'fulfilled') {
        setCustoms(customRes.value.data?.data?.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 把组织连接状态合并进连接器列表
  const integrations = useMemo(() => {
    const byServerId = new Map(tenantIntegrations.map(t => [t.mcpServerId, t]));
    return servers.map(s => ({ ...s, tenant: byServerId.get(s.id) || null }));
  }, [servers, tenantIntegrations]);

  // 由工具覆盖表推导每个连接下已知的工具（键格式：`连接名:工具名`）
  const toolsByIntegration = useMemo(() => {
    const map = {};
    Object.keys(toolOverrides).forEach(key => {
      const sep = key.indexOf(':');
      if (sep <= 0) return;
      const name = key.slice(0, sep);
      const tool = key.slice(sep + 1);
      if (!map[name]) map[name] = [];
      if (!map[name].includes(tool)) map[name].push(tool);
    });
    Object.values(map).forEach(list => list.sort());
    return map;
  }, [toolOverrides]);

  const openConfig = useCallback((integration, mode) => {
    setConfigMsg({ type: '', text: '' });
    setConfigModal({ integration, mode });
  }, []);

  const handleSave = useCallback(async (values) => {
    if (!configModal) return;
    setConfigSaving(true);
    setConfigMsg({ type: '', text: '' });
    try {
      const config = Object.keys(values).length > 0 ? values : null;
      await api.put(`/api/v1/tenant-mcp/integrations/${configModal.integration.id}`, { config });
      setConfigMsg({ type: 'success', text: '连接已保存并启用。' });
      await fetchAll();
      setActiveTab('my-tools');
      setTimeout(() => setConfigModal(null), 900);
    } catch (err) {
      setConfigMsg({ type: 'error', text: err.response?.data?.error || '保存失败。' });
    } finally {
      setConfigSaving(false);
    }
  }, [configModal, fetchAll]);

  const handleTest = useCallback(async (values) => {
    if (!configModal) return;
    setConfigTesting(true);
    setConfigMsg({ type: '', text: '' });
    try {
      const config = Object.keys(values).length > 0 ? values : null;
      const res = await api.post(`/api/v1/tenant-mcp/integrations/${configModal.integration.id}/test`, { config });
      const data = res.data?.data || {};
      setConfigMsg({ type: 'success', text: data.message || '连接测试通过。' });
    } catch (err) {
      setConfigMsg({
        type: 'error',
        text: err.response?.data?.data?.error || err.response?.data?.error || '连接测试失败。',
      });
    } finally {
      setConfigTesting(false);
    }
  }, [configModal]);

  const handleDisable = useCallback(async (integration) => {
    try {
      await api.delete(`/api/v1/tenant-mcp/integrations/${integration.id}`);
      await fetchAll();
    } catch { /* 忽略 */ }
  }, [fetchAll]);

  const handleEnable = useCallback(async (integration) => {
    try {
      await api.put(`/api/v1/tenant-mcp/integrations/${integration.id}`, {});
      await fetchAll();
    } catch { /* 忽略 */ }
  }, [fetchAll]);

  const handleRemove = useCallback(async (integration) => {
    try {
      await api.delete(`/api/v1/tenant-mcp/integrations/${integration.id}/remove`);
      setRemoveTarget(null);
      await fetchAll();
    } catch { /* 忽略 */ }
  }, [fetchAll]);

  const saveToolOverrides = useCallback((next) => {
    api.put('/api/v1/tenant-mcp/tool-overrides', { overrides: next })
      .catch(err => console.warn('[Integrations] 工具开关保存失败：', err));
  }, []);

  const handleToggleTool = useCallback((key, isOn) => {
    setToolOverrides(prev => {
      const next = { ...prev, [key]: !isOn };
      saveToolOverrides(next);
      return next;
    });
  }, [saveToolOverrides]);

  // ── 自定义 MCP ────────────────────────────────────────────────────────────
  const refreshCustoms = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/tenant-mcp/custom');
      setCustoms(res.data?.data?.items || []);
    } catch (err) {
      setCustomNotice({ type: 'error', text: err.response?.data?.error || '自定义 MCP 列表加载失败。' });
    }
  }, []);

  const openCustomModal = useCallback((item) => {
    setCustomMsg({ type: '', text: '' });
    setCustomNotice({ type: '', text: '' });
    // 导入进来的 stdio 条目只读展示，不提供在线编辑
    if (item && isStdio(item.transport)) {
      setCustomNotice({
        type: 'error',
        text: 'stdio 类型的连接不支持在线编辑，如需调整请删除后用 streamable/SSE 方式重新添加。',
      });
      return;
    }
    setCustomModal({ item: item || null });
  }, []);

  const handleCustomSave = useCallback(async (payload) => {
    setCustomSaving(true);
    setCustomMsg({ type: '', text: '' });
    try {
      const editing = customModal?.item;
      if (editing?.id) {
        await api.put(`/api/v1/tenant-mcp/custom/${editing.id}`, payload);
      } else {
        await api.post('/api/v1/tenant-mcp/custom', payload);
      }
      await refreshCustoms();
      setCustomModal(null);
      setCustomNotice({ type: 'success', text: editing?.id ? '自定义 MCP 已更新。' : '自定义 MCP 已创建。' });
    } catch (err) {
      setCustomMsg({ type: 'error', text: err.response?.data?.error || '保存失败，请稍后重试。' });
    } finally {
      setCustomSaving(false);
    }
  }, [customModal, refreshCustoms]);

  const handleCustomToggle = useCallback(async (item) => {
    setCustomBusyId(item.id);
    setCustomNotice({ type: '', text: '' });
    try {
      await api.put(`/api/v1/tenant-mcp/custom/${item.id}`, { enabled: item.enabled === false });
      await refreshCustoms();
    } catch (err) {
      setCustomNotice({ type: 'error', text: err.response?.data?.error || '切换启用状态失败。' });
    } finally {
      setCustomBusyId(null);
    }
  }, [refreshCustoms]);

  const handleCustomDelete = useCallback(async (item) => {
    setCustomBusyId(item.id);
    setCustomNotice({ type: '', text: '' });
    try {
      await api.delete(`/api/v1/tenant-mcp/custom/${item.id}`);
      setCustomDelTarget(null);
      await refreshCustoms();
      setCustomNotice({ type: 'success', text: `已删除「${item.name}」。` });
    } catch (err) {
      setCustomNotice({ type: 'error', text: err.response?.data?.error || '删除失败，请稍后重试。' });
    } finally {
      setCustomBusyId(null);
    }
  }, [refreshCustoms]);

  const openImportModal = useCallback(async () => {
    setImportLoading(true);
    setCustomNotice({ type: '', text: '' });
    setImportMsg({ type: '', text: '' });
    try {
      const res = await api.get('/api/v1/tenant-mcp/custom/importable');
      const items = res.data?.data?.items || [];
      if (items.length === 0) {
        setCustomNotice({ type: 'success', text: '没有发现可导入的配置。' });
        return;
      }
      setImportSelected(items.map(i => i.name));
      setImportModal({ items });
    } catch (err) {
      setCustomNotice({ type: 'error', text: err.response?.data?.error || '读取已有配置失败。' });
    } finally {
      setImportLoading(false);
    }
  }, []);

  const handleImportConfirm = useCallback(async () => {
    setImporting(true);
    setImportMsg({ type: '', text: '' });
    try {
      const res = await api.post('/api/v1/tenant-mcp/custom/import', { names: importSelected });
      const count = res.data?.data?.count ?? 0;
      await refreshCustoms();
      setImportModal(null);
      setImportSelected([]);
      setCustomNotice({
        type: count > 0 ? 'success' : 'error',
        text: count > 0 ? `已导入 ${count} 个配置。` : '没有导入任何配置。',
      });
    } catch (err) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || '导入失败，请稍后重试。' });
    } finally {
      setImporting(false);
    }
  }, [importSelected, refreshCustoms]);

  const toggleImportSelected = useCallback((name) => {
    setImportSelected(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  }, []);

  const toggleImportAll = useCallback((checkAll) => {
    setImportSelected(checkAll ? (importModal?.items || []).map(i => i.name) : []);
  }, [importModal]);

  // 计算派生数据
  const activeIntegrations = useMemo(() => (
    integrations
      .filter(i => i.tenant && i.tenant.status !== 'NOT_ENABLED')
      .sort((a, b) => {
        const aEnabled = a.tenant?.enabled ? -1 : 0;
        const bEnabled = b.tenant?.enabled ? -1 : 0;
        if (aEnabled !== bEnabled) return aEnabled - bEnabled;
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
  ), [integrations]);

  const tags = useMemo(() => getUniqueTags(integrations), [integrations]);

  const filtered = useMemo(() => integrations.filter(i => {
    const q = search.toLowerCase();
    const nameOk = !q
      || (i.name || '').toLowerCase().includes(q)
      || (i.description || '').toLowerCase().includes(q);
    const tagOk = activeTag === '全部' || (i.tags || []).includes(activeTag);
    return nameOk && tagOk;
  }), [integrations, search, activeTag]);

  const totalTools = useMemo(() => (
    activeIntegrations.reduce((n, i) => n + (toolsByIntegration[i.name]?.length || 0), 0)
  ), [activeIntegrations, toolsByIntegration]);

  return (
    <>
      <div className="ig-page">
        {/* 页头 */}
        <div className="ig-page-hd">
          <div>
            <h1 className="ig-page-title">组织连接</h1>
            <p className="ig-page-sub">
              把你的数据平台、情报源和云服务接入 AI 助手，统一在组织维度管理凭据与开关。
            </p>
          </div>
        </div>

        {/* 页签 */}
        <div className="ig-tabs">
          <button
            className={`ig-tab${activeTab === 'my-tools' ? ' active' : ''}`}
            onClick={() => setActiveTab('my-tools')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
            我的连接
            {activeIntegrations.length > 0 && (
              <span className="ig-tab-badge">{activeIntegrations.length}</span>
            )}
          </button>
          <button
            className={`ig-tab${activeTab === 'marketplace' ? ' active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <path d="M16 3H8L4 7h16l-4-4z" />
            </svg>
            连接市场
          </button>
          <button
            className={`ig-tab${activeTab === 'custom' ? ' active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M12 5v14M5 12h14" />
            </svg>
            自定义 MCP
            {customs.length > 0 && <span className="ig-tab-badge">{customs.length}</span>}
          </button>
        </div>

        {loading && <div className="ig-loading">正在加载连接列表…</div>}

        {!loading && pageError && <div className="ig-msg error">{pageError}</div>}

        {/* ── 我的连接 ─────────────────────────────────────────────── */}
        {!loading && activeTab === 'my-tools' && (
          <div className="ig-tab-body">
            {activeIntegrations.length === 0 ? (
              <div className="ig-empty">
                <div className="ig-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>还没有启用任何连接</h3>
                <p>前往连接市场，为组织启用需要的数据源与工具。</p>
                <button className="ig-btn-primary" onClick={() => setActiveTab('marketplace')}>
                  浏览连接市场
                </button>
              </div>
            ) : (
              <>
                <div className="ig-summary">
                  已启用 {activeIntegrations.length} 个连接
                  {totalTools > 0 && ` · 共 ${totalTools} 个工具`}
                </div>
                <div className="ig-server-list">
                  {activeIntegrations.map(int => (
                    <ServerCard
                      key={int.id}
                      integration={int}
                      tools={toolsByIntegration[int.name] || []}
                      toolOverrides={toolOverrides}
                      onConfigure={() => openConfig(int, 'edit')}
                      onToggleIntegration={() => int.tenant?.enabled ? handleDisable(int) : handleEnable(int)}
                      onRemove={() => setRemoveTarget(int)}
                      onDetails={() => setDetailTarget(int)}
                      onToggleTool={handleToggleTool}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 连接市场 ─────────────────────────────────────────────── */}
        {!loading && activeTab === 'marketplace' && (
          <div className="ig-tab-body">
            <div className="ig-filters">
              <div className="ig-search-wrap">
                <svg className="ig-search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  className="ig-search"
                  type="text"
                  placeholder="搜索连接…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="ig-tag-pills">
                {tags.map(tag => (
                  <button
                    key={tag}
                    className={`ig-tag-pill${activeTag === tag ? ' active' : ''}`}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length > 0 ? (
              <div className="ig-grid">
                {filtered.map(int => (
                  <MarketCard
                    key={int.id}
                    integration={int}
                    onEnable={() => openConfig(int, int.tenant?.enabled ? 'edit' : 'enable')}
                    onDetails={() => setDetailTarget(int)}
                  />
                ))}
              </div>
            ) : (
              <p className="ig-empty-search">没有匹配的连接。</p>
            )}
          </div>
        )}

        {/* ── 自定义 MCP ───────────────────────────────────────────── */}
        {!loading && activeTab === 'custom' && (
          <div className="ig-tab-body">
            <div className="ig-custom-note">
              自定义 MCP 现在统一在这里维护，配置会自动下发到聊天助手；聊天页「锤子」按钮仍可查看和临时开关工具。
            </div>

            <div className="ig-custom-bar">
              <div className="ig-summary" style={{ marginBottom: 0 }}>
                {customs.length > 0
                  ? `共 ${customs.length} 个自定义 MCP · 已启用 ${customs.filter(c => c.enabled !== false).length} 个`
                  : '尚未添加自定义 MCP'}
              </div>
              <div className="ig-custom-bar-actions">
                <button className="ig-btn-ghost compact" onClick={openImportModal} disabled={importLoading}>
                  {importLoading ? '读取中…' : '导入已有配置'}
                </button>
                <button className="ig-btn-primary compact" onClick={() => openCustomModal(null)}>
                  新建自定义 MCP
                </button>
              </div>
            </div>

            {customNotice.text && (
              <div className={`ig-msg ${customNotice.type}`} style={{ marginBottom: 16 }}>
                {customNotice.text}
              </div>
            )}

            {customs.length === 0 ? (
              <div className="ig-empty">
                <div className="ig-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>还没有自定义 MCP</h3>
                <p>新建一个自定义 MCP 连接，或把此前在聊天页手工添加的配置导入进来。</p>
                <button className="ig-btn-primary" onClick={() => openCustomModal(null)}>
                  新建自定义 MCP
                </button>
              </div>
            ) : (
              <div className="ig-server-list">
                {customs.map(item => (
                  <CustomMcpCard
                    key={item.id}
                    item={item}
                    busy={customBusyId === item.id}
                    onEdit={() => openCustomModal(item)}
                    onToggle={() => handleCustomToggle(item)}
                    onDelete={() => setCustomDelTarget(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {detailTarget && (
        <DetailModal
          integration={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEnable={() => { setDetailTarget(null); openConfig(detailTarget, 'enable'); }}
          onConfigure={() => { setDetailTarget(null); openConfig(detailTarget, 'edit'); }}
          onDisable={() => { setDetailTarget(null); handleDisable(detailTarget); }}
        />
      )}

      {/* 配置弹窗 */}
      {configModal && (
        <ConfigModal
          integration={configModal.integration}
          mode={configModal.mode}
          saving={configSaving}
          testing={configTesting}
          msg={configMsg}
          onSave={handleSave}
          onTest={handleTest}
          onClose={() => setConfigModal(null)}
        />
      )}

      {/* 自定义 MCP 表单弹窗 */}
      {customModal && (
        <CustomMcpModal
          item={customModal.item}
          saving={customSaving}
          msg={customMsg}
          onSave={handleCustomSave}
          onClose={() => setCustomModal(null)}
        />
      )}

      {/* 导入存量配置弹窗 */}
      {importModal && (
        <ImportModal
          items={importModal.items}
          selected={importSelected}
          importing={importing}
          msg={importMsg}
          onToggle={toggleImportSelected}
          onToggleAll={toggleImportAll}
          onConfirm={handleImportConfirm}
          onClose={() => { setImportModal(null); setImportMsg({ type: '', text: '' }); }}
        />
      )}

      {/* 删除自定义 MCP 确认 */}
      {customDelTarget && (
        <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) setCustomDelTarget(null); }}>
          <div className="ig-modal" style={{ maxWidth: 420 }}>
            <div className="ig-modal-hd" style={{ borderBottom: 'none' }}>
              <div className="ig-modal-title">删除 {customDelTarget.name}？</div>
            </div>
            <div className="ig-modal-body" style={{ padding: '8px 24px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                这会删除该自定义 MCP 的全部配置（含已保存的认证凭据），操作不可撤销。如果只是想临时关闭，请使用启用开关。
              </p>
            </div>
            <div className="ig-modal-ft">
              <button
                className="ig-btn-danger"
                onClick={() => handleCustomDelete(customDelTarget)}
                disabled={customBusyId === customDelTarget.id}
              >
                {customBusyId === customDelTarget.id ? '删除中…' : '删除'}
              </button>
              <button className="ig-btn-ghost" onClick={() => setCustomDelTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 彻底移除确认 */}
      {removeTarget && (
        <div className="ig-overlay" onClick={e => { if (e.target === e.currentTarget) setRemoveTarget(null); }}>
          <div className="ig-modal" style={{ maxWidth: 420 }}>
            <div className="ig-modal-hd" style={{ borderBottom: 'none' }}>
              <div className="ig-modal-title">彻底移除 {removeTarget.name}？</div>
            </div>
            <div className="ig-modal-body" style={{ padding: '8px 24px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                这会删除已保存的连接配置（含凭据），操作不可撤销。如果只是想临时关闭，请使用「禁用」。
              </p>
            </div>
            <div className="ig-modal-ft">
              <button className="ig-btn-danger" onClick={() => handleRemove(removeTarget)}>彻底移除</button>
              <button className="ig-btn-ghost" onClick={() => setRemoveTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Integrations;
