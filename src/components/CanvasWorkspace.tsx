'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Maximize2, Code } from 'lucide-react';

interface CanvasWorkspaceProps {
  htmlCode: string;
}

export function CanvasWorkspace({ htmlCode }: CanvasWorkspaceProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
          <Code size={16} color="var(--primary)" /> Live Canvas Preview
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-icon" onClick={handleRefresh} title="Refresh Preview">
            <RefreshCw size={14} />
          </button>
          <button className="btn-icon" title="Open in New Tab" onClick={() => {
            const blob = new Blob([htmlCode], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
          }}>
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, background: '#ffffff', position: 'relative' }}>
        {htmlCode ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={htmlCode}
            sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
            title="Preview Canvas"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: '12px' }}>
            <Code size={48} opacity={0.2} />
            <p>No HTML/UI code generated yet.</p>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Ask JARVIS to build a web component or HTML app.</span>
          </div>
        )}
      </div>
    </div>
  );
}
