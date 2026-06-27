'use client';

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save } from 'lucide-react';

interface IdeWorkspaceProps {
  code: string;
  onRun: (code: string) => void;
  output: string;
  isExecuting: boolean;
}

export function IdeWorkspace({ code: initialCode, onRun, output, isExecuting }: IdeWorkspaceProps) {
  const [code, setCode] = useState(initialCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#252526', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#4ec9b0', fontSize: '0.9rem', fontWeight: 600 }}>Python Workspace</span>
          <span style={{ color: '#858585', fontSize: '0.8rem' }}>main.py</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onRun(code)}
            disabled={isExecuting}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              background: isExecuting ? '#4d4d4d' : '#10b981', 
              color: '#fff', border: 'none', borderRadius: '4px', 
              padding: '4px 12px', fontSize: '0.8rem', cursor: isExecuting ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {isExecuting ? <RotateCcw size={14} className="animate-spin" /> : <Play size={14} />}
            {isExecuting ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            wordWrap: 'on',
            lineNumbersMinChars: 3,
          }}
        />
      </div>

      <div style={{ height: '30%', background: '#1e1e1e', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#858585', background: '#2d2d2d', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Terminal Output
        </div>
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
          {output || 'System Ready...'}
        </div>
      </div>
    </div>
  );
}
