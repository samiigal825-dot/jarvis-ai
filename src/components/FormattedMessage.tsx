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
    
    // Check for <thinking>...</thinking>
    const thinkingRegex = /<thinking>([\s\S]*?)(?:<\/thinking>|$)/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = thinkingRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textPart = content.slice(lastIndex, match.index);
        parts.push(...parseMarkdown(textPart));
      }
      
      parts.push({
        type: 'thinking',
        content: match[1].trim()
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(...parseMarkdown(content.slice(lastIndex)));
    }
    
    // Now process [GENERATE_FILE] inside the non-thinking parts if necessary (or we can just keep them separate).
    // To make it simple, let's just do a second pass for GENERATE_FILE on 'text' parts.
    const finalParts: Part[] = [];
    parts.forEach(part => {
      if (part.type === 'text') {
        const fileRegex = /\[GENERATE_FILE:([^\]]+)\]([\s\S]*?)\[\/GENERATE_FILE\]/g;
        let tLast = 0;
        let tMatch;
        while ((tMatch = fileRegex.exec(part.content)) !== null) {
          if (tMatch.index > tLast) {
            finalParts.push({ type: 'text', content: part.content.slice(tLast, tMatch.index) });
          }
          finalParts.push({ type: 'file', filename: tMatch[1], content: tMatch[2].trim() });
          tLast = tMatch.index + tMatch[0].length;
        }
        if (tLast < part.content.length) {
          finalParts.push({ type: 'text', content: part.content.slice(tLast) });
        }
      } else {
        finalParts.push(part);
      }
    });

    return finalParts.map((part, index) => {
      if (part.type === 'file') {
        return (
          <div key={index} style={{ margin: '12px 0', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)', marginBottom: '4px' }}>File Generated</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{part.filename}</div>
            </div>
            <button className="btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleDownload(part.filename!, part.content)}>
              <Download size={16} /> Download
            </button>
          </div>
        );
      }
      
      if (part.type === 'thinking') {
        return (
          <details key={index} className="thinking-block" open={false}>
            <summary className="thinking-header">
              <span className="thinking-icon">🧠</span>
              <span className="thinking-title">Agentic Reasoning Process</span>
            </summary>
            <div className="thinking-content" dangerouslySetInnerHTML={{ __html: formatText(part.content) }} />
          </details>
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
    
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
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
        codeStr += line + '\n';
      } else {
        curr += line + '\n';
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
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
  return html;
}
