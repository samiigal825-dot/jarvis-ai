'use client';

import React from 'react';
import { MessageSquare, Plus, Settings, Trash2, HardDrive, BrainCircuit } from 'lucide-react';
import { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  onDataFilesOpen: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ conversations, currentId, onSelect, onNew, onDelete, onSettings, onDataFilesOpen, isOpen, setIsOpen }: SidebarProps) {
  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'show' : ''}`} onClick={() => setIsOpen(false)} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon"><BrainCircuit size={20} color="white" /></div>
          <div>
            <h1>JARVIS</h1>
            <div className="sidebar-brand-sub">CEO AI Platform</div>
          </div>
          <button className="sidebar-close" onClick={() => setIsOpen(false)}>×</button>
        </div>

        <button className="btn-new" onClick={() => { onNew(); setIsOpen(false); }}>
          <Plus size={16} /> New Chat
        </button>

        <div className="sidebar-search">
          <MessageSquare className="sidebar-search-icon" size={14} />
          <input type="text" placeholder="Search chats..." />
        </div>

        <div className="section-label">Recent Conversations</div>
        <div className="convo-list">
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No conversations yet.
            </div>
          ) : (
            conversations.map(c => (
              <div 
                key={c.id} 
                className={`convo-item ${currentId === c.id ? 'active' : ''}`}
                onClick={() => { onSelect(c.id); setIsOpen(false); }}
              >
                <MessageSquare size={14} />
                <span className="convo-title">{c.title}</span>
                <button 
                  className="btn-icon convo-delete" 
                  style={{ width: 24, height: 24, marginLeft: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={() => { onDataFilesOpen(); setIsOpen(false); }}>
            <HardDrive size={16} /> Data & Files
          </button>
          <button className="sidebar-footer-btn" onClick={onSettings}>
            <Settings size={16} /> Settings
          </button>
        </div>
      </aside>
    </>
  );
}
