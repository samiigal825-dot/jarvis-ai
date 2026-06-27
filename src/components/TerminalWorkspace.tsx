'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebContainer } from '@webcontainer/api';
import '@xterm/xterm/css/xterm.css';
import { Play, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalWorkspaceProps {
  files?: Record<string, string>;
}

let webcontainerInstance: WebContainer | null = null;

export function TerminalWorkspace({ files = {} }: TerminalWorkspaceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#fff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    const initWebContainer = async () => {
      try {
        term.write('\x1b[36mInitializing JARVIS Real Execution Environment...\x1b[0m\r\n');
        
        if (!webcontainerInstance) {
          webcontainerInstance = await WebContainer.boot();
        }

        term.write('\x1b[32mEnvironment Booted. Mounting files...\x1b[0m\r\n');

        const tree: any = {};
        for (const [path, content] of Object.entries(files)) {
          tree[path] = {
            file: { contents: content }
          };
        }

        await webcontainerInstance.mount(tree);
        term.write('\x1b[32mFiles Mounted Successfully. Ready.\x1b[0m\r\n\r\n');
        setIsBooting(false);

        const shellProcess = await webcontainerInstance.spawn('jsh');
        
        shellProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              term.write(data);
            }
          })
        );

        const input = shellProcess.input.getWriter();
        term.onData((data) => {
          input.write(data);
        });

      } catch (err: any) {
        setBootError(err.message);
        term.write(`\x1b[31mError booting environment: ${err.message}\x1b[0m\r\n`);
      }
    };

    initWebContainer();

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isBooting && webcontainerInstance) {
      const tree: any = {};
      for (const [path, content] of Object.entries(files)) {
        tree[path] = {
          file: { contents: content }
        };
      }
      webcontainerInstance.mount(tree).catch(console.error);
    }
  }, [files, isBooting]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={16} color="#4ec9b0" /> 
          JARVIS Secure Terminal
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: isBooting ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isBooting ? '#f59e0b' : '#10b981' }} />
            {isBooting ? 'Booting Sandbox...' : 'System Ready'}
          </span>
        </div>
      </div>
      
      {bootError && (
        <div style={{ padding: '8px', background: '#451a1a', color: '#fca5a5', fontSize: '0.8rem', textAlign: 'center' }}>
          Failed to boot: Ensure Cross-Origin-Embedder-Policy headers are set.
        </div>
      )}

      <div style={{ flex: 1, padding: '12px', position: 'relative' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
