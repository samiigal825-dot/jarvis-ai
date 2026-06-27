'use client';

import React, { useState } from 'react';
import { FormattedMessage } from './FormattedMessage';
import { Message } from '../types';
import { Copy, RefreshCw, Pencil, ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
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

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-assistant'}`}>
      <div className="msg-header">
        <span className="msg-avatar">{isUser ? '👤' : '🤖'}</span>
        <span className="msg-sender">{isUser ? 'You' : 'Jarvis'}</span>
      </div>
      <div className="msg-bubble">
        {isFileMessage ? (
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
          <FormattedMessage content={message.content} />
        )}
        {isStreaming && <span className="streaming-cursor" />}
      </div>
      <div className="msg-actions">
        <button className="msg-action-btn" title="Copy" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {!isUser && (
          <>
            <button className="msg-action-btn" title="Regenerate"><RefreshCw size={14} /></button>
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
