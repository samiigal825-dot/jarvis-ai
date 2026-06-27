'use client';

import React, { useState, useEffect } from 'react';
import { Settings as SettingsType, HFModel } from '../types';
import { X, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsType;
  onSave: (s: SettingsType) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [models, setModels] = useState<HFModel[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      fetch('/api/chat')
        .then(r => r.json())
        .then(data => setModels(data.models || []))
        .catch(console.error);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass" onClick={e => e.stopPropagation()}>
        <button className="btn-icon modal-close" onClick={onClose}><X size={20} /></button>
        <h2 className="modal-title">Settings</h2>

        <div className="settings-group" style={{ marginBottom: 24 }}>
          <label className="settings-label">HuggingFace API Key (Optional)</label>
          <input 
            type="password" 
            className="settings-input" 
            value={localSettings.hfToken}
            onChange={e => setLocalSettings({ ...localSettings, hfToken: e.target.value })}
            placeholder="hf_..."
          />
          <div className="settings-hint">Add your own token for higher rate limits. By default, it uses the server token.</div>
        </div>

        <div className="settings-group" style={{ marginBottom: 32 }}>
          <label className="settings-label">Default AI Model</label>
          <div className="model-dropdown" style={{ border: '1px solid var(--border)', padding: 8 }}>
            {models.map(m => (
              <button 
                key={m.id}
                className={`model-option ${localSettings.defaultModel === m.id ? 'active' : ''}`}
                onClick={() => setLocalSettings({ ...localSettings, defaultModel: m.id })}
              >
                <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                  <span style={{ fontSize: '0.7rem' }}>{m.id}</span>
                </div>
                {localSettings.defaultModel === m.id && <Check size={16} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn-new" style={{ width: 'auto' }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
