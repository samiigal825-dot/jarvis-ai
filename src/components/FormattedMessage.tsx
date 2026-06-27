'use client';

import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';

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

  const handleDownload = (filename: string, data: string) => {
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Complex parser for Markdown + Code Blocks + GENERATE_FILE tags
  const renderParts = () => {
    type Part = { type: string; content: string; language?: string; filename?: string };
    const parts: Part[] = [];
    let currentText = '';
    
    // Check for [GENERATE_FILE:filename]...[/GENERATE_FILE]
    const fileRegex = /\[GENERATE_FILE:([^\]]+)\]([\s\S]*?)\[\/GENERATE_FILE\]/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = fileRegex.exec(content)) !== null) {
      // Add preceding text
      if (match.index > lastIndex) {
        const textPart = content.slice(lastIndex, match.index);
        parts.push(...parseMarkdown(textPart));
      }
      
      // Add the file generation block
      parts.push({
        type: 'file',
        filename: match[1],
        content: match[2].trim()
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(...parseMarkdown(content.slice(lastIndex)));
    }
    
    return parts.map((part, index) => {
      if (part.type === 'file') {
        return (
          <div key={index} style={{ margin: '12px 0', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)', marginBottom: '4px' }}>File Generated</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{part.filename}</div>
            </div>
            <button className="btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleDownload(part.filename, part.content)}>
              <Download size={16} /> Download
            </button>
          </div>
        );
      }
      
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
      
      return (
        <div key={index} className="msg-content" dangerouslySetInnerHTML={{ __html: formatText(part.content) }} />
      );
    });
  };

  function parseMarkdown(text: string) {
    type Part = { type: string; content: string; language?: string; filename?: string };
    const p: Part[] = [];
    let curr = '';
    let inCode = false;
    let lang = '';
    let codeStr = '';
    
    const lines = text.split('\\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('\`\`\`')) {
        if (inCode) {
          p.push({ type: 'code', language: lang, content: codeStr.trim() });
          inCode = false;
          lang = '';
          codeStr = '';
        } else {
          if (curr) p.push({ type: 'text', content: curr });
          curr = '';
          inCode = true;
          lang = line.slice(3).trim();
        }
      } else if (inCode) {
        codeStr += line + '\\n';
      } else {
        curr += line + '\\n';
      }
    }
    if (curr) p.push({ type: 'text', content: curr });
    if (codeStr) p.push({ type: 'code', language: lang, content: codeStr.trim() });
    
    return p;
  }

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
