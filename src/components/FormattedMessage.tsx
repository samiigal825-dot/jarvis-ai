'use client';

import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
  onPreview?: (code: string) => void;
  onRun?: (code: string) => void;
}

export function FormattedMessage({ content, onPreview, onRun }: FormattedMessageProps) {
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
    
    // Check for <thinking>...</thinking> or <think>...</think>
    const thinkingRegex = /<(?:thinking|think)>([\s\S]*?)(?:<\/(?:thinking|think)>|$)/g;
    
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
            <div style={{ display: 'flex', gap: '8px' }}>
              {onPreview && (part.filename?.endsWith('.html') || part.filename?.endsWith('.htm')) && (
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onPreview(part.content)}>
                  Preview
                </button>
              )}
              {onRun && part.filename?.endsWith('.py') && (
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onRun(part.content)}>
                  Run IDE
                </button>
              )}
              <button className="btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleDownload(part.filename!, part.content)}>
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        );
      }
      
      if (part.type === 'thinking') {
        return (
          <details key={index} className="thinking-block" open>
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
        
        let previewCode = part.content;
        if (part.language === 'html') {
          const cssBlocks = finalParts.filter(p => p.type === 'code' && p.language === 'css').map(p => p.content);
          const jsBlocks = finalParts.filter(p => p.type === 'code' && (p.language === 'javascript' || p.language === 'js' || p.language === 'javascript' || p.language === 'ts' || p.language === 'typescript')).map(p => p.content);
          
          if (cssBlocks.length > 0 && !previewCode.includes('<style>')) {
            if (previewCode.includes('</head>')) {
              previewCode = previewCode.replace(/<\/head>/i, `<style>\n${cssBlocks.join('\n')}\n</style>\n</head>`);
            } else {
              previewCode = `<style>\n${cssBlocks.join('\n')}\n</style>\n` + previewCode;
            }
          }
          if (jsBlocks.length > 0 && !previewCode.includes('<script>')) {
            if (previewCode.includes('</body>')) {
              previewCode = previewCode.replace(/<\/body>/i, `<script>\n${jsBlocks.join('\n')}\n</script>\n</body>`);
            } else {
              previewCode = previewCode + `\n<script>\n${jsBlocks.join('\n')}\n</script>`;
            }
          }
        }

        return (
          <div key={index} className="code-block">
            <div className="code-header">
              <span>{part.language || 'text'}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onPreview && (part.language === 'html' || part.language === 'javascript' || part.language === 'js') && (
                  <button className="code-copy-btn" onClick={() => onPreview(previewCode)}>
                    ▶ Preview
                  </button>
                )}
                {onRun && (part.language === 'python' || part.language === 'py') && (
                  <button className="code-copy-btn" onClick={() => onRun(part.content)}>
                    ▶ Run
                  </button>
                )}
                <button className="code-copy-btn" onClick={() => handleCopy(part.content)}>
                  {isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
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
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline Code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Unordered Lists
    .replace(/^[-*] (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/<\/ul>\s*<ul>/gim, '')
    // Ordered Lists
    .replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
    .replace(/<\/ol>\s*<ol>/gim, '')
    // Newlines
    .replace(/\n/g, '<br/>')
    // Cleanup BR tags after block elements
    .replace(/<\/h(\d)><br\/>/g, '</h$1>')
    .replace(/<\/ul><br\/>/g, '</ul>')
    .replace(/<\/ol><br\/>/g, '</ol>')
    .replace(/<\/blockquote><br\/>/g, '</blockquote>');
  return html;
}
