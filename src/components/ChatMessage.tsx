'use client';

import React, { useState } from 'react';
import { FormattedMessage } from './FormattedMessage';
import { Message } from '../types';
import { Copy, RefreshCw, Pencil, ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onPreview?: (code: string) => void;
  onRun?: (code: string) => void;
  onRegenerate?: () => void;
}

export function ChatMessage({ message, isStreaming, onPreview, onRun, onRegenerate }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileUploadMatch = message.content.match(/^\[UPLOADED_FILE:\s*([^\]]+)\]/);
  const isFileMessage = !!fileUploadMatch;
  const fileName = fileUploadMatch ? fileUploadMatch[1] : '';

  const isErrorMessage = message.content.includes('⚠️');

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-assistant'}`}>
      <div className="msg-header">
        <span className="msg-avatar">{isUser ? '👤' : '🤖'}</span>
        <span className="msg-sender">{isUser ? 'You' : 'Jarvis'}</span>
      </div>
      <div className="msg-bubble">
        {isErrorMessage ? (
          <div className="error-alert-card" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 18px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            margin: '6px 0',
            maxWidth: '550px'
          }}>
            <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' }}>⚠️</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ef4444' }}>System Connection Error</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {message.content.replace(/[⚠️\s*#]+/g, '').replace(/API Error: /i, '').replace(/System Error: /i, '')}
              </span>
            </div>
          </div>
        ) : isFileMessage ? (
          <div className="file-upload-card" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            margin: '4px 0',
            maxWidth: '400px'
          }}>
            <span style={{ fontSize: '1.8rem' }}>
              {/\.(png|jpe?g|gif|webp)$/i.test(fileName) ? '🖼️' : '📎'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{fileName}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                {/\.(png|jpe?g|gif|webp)$/i.test(fileName) 
                  ? 'Image analyzed by Vision AI. Ready for questions.' 
                  : 'Attached & parsed successfully. Ready for instructions.'}
              </span>
            </div>
          </div>
        ) : (
          <FormattedMessage content={message.content} onPreview={onPreview} onRun={onRun} />
        )}
        {isStreaming && <span className="streaming-cursor" />}
      </div>
      <div className="msg-actions">
        <button className="msg-action-btn" title="Copy" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {!isUser && (
          <>
            <button className="msg-action-btn" title="Regenerate" onClick={onRegenerate}><RefreshCw size={14} /></button>
            <button className="msg-action-btn" title="Good Response"><ThumbsUp size={14} /></button>
            <button className="msg-action-btn" title="Bad Response"><ThumbsDown size={14} /></button>
          </>
        )}
        {isUser && (
          <button className="msg-action-btn" title="Edit"><Pencil size={14} /></button>
        )}
      </div>
    </div>
  );
}
