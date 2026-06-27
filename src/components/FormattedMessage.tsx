'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
}

export function FormattedMessage({ content }: FormattedMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Simple Markdown parser
  const renderParts = () => {
    const parts = [];
    let currentText = '';
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent = '';
    
    const lines = content.split('\\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('\`\`\`')) {
        if (inCodeBlock) {
          parts.push({ type: 'code', language: codeLanguage, content: codeContent.trim() });
          inCodeBlock = false;
          codeLanguage = '';
          codeContent = '';
        } else {
          if (currentText) {
            parts.push({ type: 'text', content: currentText });
            currentText = '';
          }
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
        }
      } else if (inCodeBlock) {
        codeContent += line + '\\n';
      } else {
        currentText += line + '\\n';
      }
    }
    
    if (currentText) {
      parts.push({ type: 'text', content: currentText });
    }
    
    return parts.map((part, index) => {
      if (part.type === 'code') {
        const isCopied = copiedCode === part.content;
        return (
          <div key={index} className="code-block">
            <div className="code-header">
              <span>{part.language || 'text'}</span>
              <button className="code-copy-btn" onClick={() => handleCopy(part.content)}>
                {isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre>
              <code>{part.content}</code>
            </pre>
          </div>
        );
      }
      
      // Basic text formatting (bold, links, etc would go here in a real parser)
      return (
        <div key={index} className="msg-content" dangerouslySetInnerHTML={{ __html: formatText(part.content) }} />
      );
    });
  };

  return <>{renderParts()}</>;
}

function formatText(text: string) {
  let html = text
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
    .replace(/\`([^`]+)\`/g, '<code>$1</code>')
    .replace(/\\n/g, '<br/>');
  return html;
}
