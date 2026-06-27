'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { Message, Conversation, Settings } from '@/types';
import { Menu, Moon, Sun, Bot, Activity, Code, Database, Terminal as TerminalIcon } from 'lucide-react';
import { SwarmVisualizer } from '@/components/SwarmVisualizer';
import { IdeWorkspace } from '@/components/IdeWorkspace';
import { DataStudio } from '@/components/DataStudio';
import { CanvasWorkspace } from '@/components/CanvasWorkspace';
import { TerminalWorkspace } from '@/components/TerminalWorkspace';
import JSZip from 'jszip';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    hfToken: '',
    theme: 'dark',
    defaultModel: 'meta-llama/Meta-Llama-3-8B-Instruct',
  });

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'swarm' | 'ide' | 'data' | 'canvas' | 'terminal'>('swarm');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [activeAgent, setActiveAgent] = useState('None');
  const [activeTask, setActiveTask] = useState('');
  const [ideCode, setIdeCode] = useState('print("Hello from JARVIS CEO!")');
  const [ideOutput, setIdeOutput] = useState('');
  const [isIdeRunning, setIsIdeRunning] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [canvasCode, setCanvasCode] = useState('');
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [isDataFilesOpen, setIsDataFilesOpen] = useState(false);

  useEffect(() => {
    const localSettings = localStorage.getItem('jarvis_settings');
    if (localSettings) {
      try {
        setSettings(JSON.parse(localSettings));
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jarvis_settings', JSON.stringify(settings));
    // Set theme class on document body
    if (settings.theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [settings]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const localConvs = localStorage.getItem('jarvis_conversations');
    const localCurrentId = localStorage.getItem('jarvis_current_id');
    if (localConvs) {
      const parsed = JSON.parse(localConvs);
      setConversations(parsed);
      if (localCurrentId) {
        setCurrentId(localCurrentId);
        const active = parsed.find((c: any) => c.id === localCurrentId);
        if (active) setMessages(active.messages);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jarvis_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (currentId) {
      localStorage.setItem('jarvis_current_id', currentId);
    } else {
      localStorage.removeItem('jarvis_current_id');
    }
  }, [currentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-sync active conversation messages
  useEffect(() => {
    if (currentId && messages.length > 0) {
      setConversations(prev => {
        // Only update if messages actually changed to avoid infinite loop
        const active = prev.find(c => c.id === currentId);
        if (active && JSON.stringify(active.messages) !== JSON.stringify(messages)) {
          return prev.map(c => c.id === currentId ? { ...c, messages, updatedAt: Date.now() } : c);
        }
        return prev;
      });
    }
  }, [messages, currentId]);

  const handleNewChat = () => {
    setCurrentId(null);
    setMessages([]);
  };

  const handleSend = async (e?: React.FormEvent, promptOverride?: string, historyOverride?: Message[]) => {
    e?.preventDefault();
    const text = promptOverride || input;
    if (!text.trim() || isLoading) return;

    if (!promptOverride) setInput('');
    setIsLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const currentMessages = historyOverride || messages;
    const newMessages = [...currentMessages, userMsg];
    
    // Only add user message to UI if it's not a background tool response
    if (!promptOverride?.startsWith('[SYSTEM_TOOL_RESPONSE]')) {
      setMessages(newMessages);
    }

    let activeId = currentId;
    if (!activeId) {
      activeId = Date.now().toString();
      setCurrentId(activeId);
      setConversations([{ id: activeId, title: text.slice(0, 30) + '...', messages: newMessages, updatedAt: Date.now() }, ...conversations]);
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/langgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          model: settings.defaultModel,
          hfToken: settings.hfToken
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(await response.text());
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        assistantMsg.content = fullContent;
        
        setMessages(prev => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...assistantMsg };
          return arr;
        });

        // Live extract ALL files
        const fileRegex = /\[GENERATE_FILE:([^\]]+)\]([\s\S]*?)(?:\[\/GENERATE_FILE\]|$)/gi;
        let match;
        const extractedFiles: Record<string, string> = {};
        while ((match = fileRegex.exec(fullContent)) !== null) {
          extractedFiles[match[1].trim()] = match[2].trim();
        }
        
        if (Object.keys(extractedFiles).length > 0) {
          setProjectFiles(prev => {
            const newFiles = { ...prev, ...extractedFiles };
            
            // Check if we have an HTML entry point
            const htmlFile = Object.keys(newFiles).find(f => f.endsWith('.html') || f.endsWith('.htm'));
            if (htmlFile) {
              let injectedHtml = newFiles[htmlFile];
              
              // Inject CSS
              const cssFiles = Object.keys(newFiles).filter(f => f.endsWith('.css'));
              cssFiles.forEach(css => {
                const regex = new RegExp(`<link\\s+[^>]*href=["'](?:.\\/)?${css.replace('.', '\\.')}["'][^>]*>`, 'i');
                if (regex.test(injectedHtml)) {
                  injectedHtml = injectedHtml.replace(regex, `<style>\n${newFiles[css]}\n</style>`);
                } else if (injectedHtml.includes('</head>')) {
                  injectedHtml = injectedHtml.replace(/<\/head>/i, `<style>\n${newFiles[css]}\n</style>\n</head>`);
                } else {
                  injectedHtml = `<style>\n${newFiles[css]}\n</style>\n` + injectedHtml;
                }
              });
              
              // Inject JS
              const jsFiles = Object.keys(newFiles).filter(f => f.endsWith('.js'));
              jsFiles.forEach(js => {
                const regex = new RegExp(`<script\\s+[^>]*src=["'](?:.\\/)?${js.replace('.', '\\.')}["'][^>]*><\\/script>`, 'i');
                if (regex.test(injectedHtml)) {
                  injectedHtml = injectedHtml.replace(regex, `<script>\n${newFiles[js]}\n</script>`);
                } else if (injectedHtml.includes('</body>')) {
                  injectedHtml = injectedHtml.replace(/<\/body>/i, `<script>\n${newFiles[js]}\n</script>\n</body>`);
                } else {
                  injectedHtml = injectedHtml + `\n<script>\n${newFiles[js]}\n</script>`;
                }
              });
              
              setCanvasCode(injectedHtml);
              if (activeWorkspaceTab !== 'canvas') {
                setActiveWorkspaceTab('canvas');
                setIsWorkspaceOpen(true);
              }
            }
            
            return newFiles;
          });
        }
        
        // Check for tool calls to abort stream early and prevent hallucinations
        if (
          fullContent.includes('[/SUBAGENT]') || 
          fullContent.includes('[/RUN_PYTHON]') ||
          fullContent.match(/\[SEARCH:(.*?)\]/) ||
          fullContent.match(/\[GENERATE_IMAGE:(.*?)\]/)
        ) {
          abortControllerRef.current?.abort();
          break;
        }
      }

      // Auto ZIP Generation Notification
      const fileMatches = [...fullContent.matchAll(/\[GENERATE_FILE:([^\]]+)\]/gi)];
      if (fileMatches.length > 1) {
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'system', content: `📦 **Project Bundle Ready!** ${fileMatches.length} files generated. Open **Data & Files** to download the complete ZIP archive.`, timestamp: Date.now() }
        ]);
      }

      // Check for Image Generation Tool
      const imageMatch = fullContent.match(/\[GENERATE_IMAGE:(.*?)\]/i);
      if (imageMatch && imageMatch[1]) {
        const prompt = imageMatch[1].trim();
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'system', content: `🎨 Generating image for: "${prompt}"...`, timestamp: Date.now() }
        ]);
        
        try {
          const imgRes = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, hfToken: settings.hfToken })
          });
          const imgData = await imgRes.json();
          const imgOutput = imgData.image || imgData.error;
          
          setIsLoading(false);
          if (imgData.image) {
            await handleSend(undefined, `[SYSTEM_TOOL_RESPONSE] Image generated successfully.\n![Generated Image](${imgOutput})`, [...newMessages, assistantMsg]);
          } else {
            await handleSend(undefined, `[SYSTEM_TOOL_RESPONSE] Image generation failed: ${imgOutput}`, [...newMessages, assistantMsg]);
          }
        } catch (err: any) {
          setIsLoading(false);
          await handleSend(undefined, `[SYSTEM_TOOL_RESPONSE] Image generation error: ${err.message}`, [...newMessages, assistantMsg]);
        }
        return;
      }

      // Check for Autonomous Tool Calls
      const searchMatch = fullContent.match(/\[SEARCH:(.*?)\]/);
      if (searchMatch && searchMatch[1] && !['query', 'your search query', 'your_search_query', '<query>', 'your-search-query'].includes(searchMatch[1].trim().toLowerCase())) {
        const query = searchMatch[1].trim();
        // Append system message to UI to show we are searching
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'system', content: `🔍 Searching the web for: "${query}"...`, timestamp: Date.now() }
        ]);
        
        // Execute search
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const searchData = await searchRes.json();
        const searchResultText = searchData.results || 'No results found.';
        
        // Send back to AI automatically!
        setIsLoading(false); // reset so we can call again
        await handleSend(
          undefined, 
          `[SYSTEM_TOOL_RESPONSE] Search Results for "${query}":\n${searchResultText}\n\nPlease continue your answer based on these results.`,
          [...newMessages, assistantMsg]
        );
        return;
      }

      // Check for Python Code Execution Tool
      const pythonMatch = fullContent.match(/\[RUN_PYTHON\]([\s\S]*?)\[\/RUN_PYTHON\]/);
      if (pythonMatch && pythonMatch[1]) {
        const rawCode = pythonMatch[1].trim();
        setIdeCode(rawCode);
        setActiveWorkspaceTab('ide');
        setIsWorkspaceOpen(true);
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'system', content: `💻 Executing Python script autonomously in Workspace...`, timestamp: Date.now() }
        ]);
        
        setIsIdeRunning(true);
        const runRes = await fetch('/api/run-python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: rawCode })
        });
        const runData = await runRes.json();
        const runOutput = runData.output || runData.error || 'No output.';
        setIdeOutput(runOutput);
        setIsIdeRunning(false);
        
        setIsLoading(false);
        await handleSend(
          undefined,
          `[SYSTEM_TOOL_RESPONSE] Python Execution Output:\n\`\`\`\n${runOutput}\n\`\`\`\n\nPlease analyze this output, explain it, and continue your task.`,
          [...newMessages, assistantMsg]
        );
        return;
      }
      
      // Check for Subagent Delegation
      const subagentMatch = fullContent.match(/\[SUBAGENT:\s*([^\]]+)\]([\s\S]*?)\[\/SUBAGENT\]/i) 
                         || fullContent.match(/SUBAGENT:\s*([^\n\[\]]+)\n([\s\S]*?)(?:WAITING|ASSIGNING|\[SUBAGENT|\[\/SUBAGENT\]|$)/i);
      if (subagentMatch && subagentMatch[1] && subagentMatch[2]) {
        const role = subagentMatch[1].trim();
        const task = subagentMatch[2].trim();
        
        setActiveAgent(role);
        setActiveTask(task);
        setActiveWorkspaceTab('swarm');
        setIsWorkspaceOpen(true);
        
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'system', content: `🤖 Delegating to Subagent '${role}' for: "${task.slice(0, 50)}..."`, timestamp: Date.now() }
        ]);
        
        const subRes = await fetch('/api/subagent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, task, hfToken: settings.hfToken })
        });
        
        const subData = await subRes.json();
        const subOutput = subData.result || subData.error || 'No output.';
        
        setIsLoading(false);
        setActiveAgent('JARVIS');
        
        // Render chart if data was output
        const chartMatch = subOutput.match(/\[RENDER_CHART:\s*([\s\S]*?)\]/);
        if (chartMatch && chartMatch[1]) {
          try {
            setChartData(JSON.parse(chartMatch[1]));
            setActiveWorkspaceTab('data');
          } catch(e) {}
        }
        
        await handleSend(
          undefined,
          `[SYSTEM_TOOL_RESPONSE] Subagent '${role}' execution output:\n\`\`\`\n${subOutput.replace(/\[RENDER_CHART:[\s\S]*?\]/, '')}\n\`\`\`\n\nPlease analyze this result and continue your primary task.`,
          [...newMessages, assistantMsg]
        );
        return;
      }
      
      setActiveAgent('None');
      setActiveTask('');
      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...newMessages, assistantMsg], updatedAt: Date.now() } : c
      ));

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: '⚠️ **Error:** ' + err.message, 
          timestamp: Date.now() 
        }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = (msgIndex: number) => {
    if (msgIndex <= 0 || isLoading) return;
    const previousUserMsg = messages[msgIndex - 1];
    if (previousUserMsg.role !== 'user') return;
    
    const historyBeforeUserMsg = messages.slice(0, msgIndex - 1);
    handleSend(undefined, previousUserMsg.content, historyBeforeUserMsg);
  };

  const handleFileUploaded = (fileName: string, extractedData: string) => {
    const fileMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `[UPLOADED_FILE: ${fileName}]\n\nFile Content:\n\`\`\`\n${extractedData}\n\`\`\``,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, fileMsg]);

    let activeId = currentId;
    if (!activeId) {
      activeId = Date.now().toString();
      setCurrentId(activeId);
      setConversations([{ id: activeId, title: `Uploaded ${fileName}`, messages: [fileMsg], updatedAt: Date.now() }, ...conversations]);
    } else {
      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...c.messages, fileMsg], updatedAt: Date.now() } : c
      ));
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  return (
    <div className="app">
      <Sidebar 
        conversations={conversations}
        currentId={currentId}
        onSelect={(id) => {
          setCurrentId(id);
          const c = conversations.find(x => x.id === id);
          if (c) setMessages(c.messages);
        }}
        onNew={handleNewChat}
        onDelete={(id) => setConversations(conversations.filter(c => c.id !== id))}
        onSettings={() => setIsSettingsOpen(true)}
        onDataFilesOpen={() => setIsDataFilesOpen(true)}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <div className="layout-container" style={{ display: 'flex', flex: 1, width: '100%', overflow: 'hidden' }}>
        <main className="main" style={{ flex: isWorkspaceOpen ? '0 0 60%' : '1', borderRight: isWorkspaceOpen ? '1px solid var(--border)' : 'none', transition: 'flex 0.3s' }}>
          <header className="chat-header">
            <div className="chat-header-left">
              <button className="btn-icon chat-header-menu" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="chat-header-model">
                <span className="chat-header-model-icon">🤖</span>
                <span className="chat-header-title">Jarvis CEO</span>
                <span className="chat-header-badge">Autonomous Agent</span>
              </div>
            </div>
            <div className="chat-header-right">
              <div className="chat-header-status">
                <Bot size={14} /> Ready
              </div>
              <button className="btn-icon" onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)} title="Toggle Workspace">
                <Activity size={18} />
              </button>
              <button className="btn-icon" onClick={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
                {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </header>

        <div className="messages">
          {messages.length === 0 ? (
            <WelcomeScreen onPromptClick={(p) => handleSend(undefined, p)} />
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage 
                key={msg.id} 
                message={msg} 
                isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'} 
                onPreview={(code) => {
                  setCanvasCode(code);
                  setActiveWorkspaceTab('canvas');
                  setIsWorkspaceOpen(true);
                }}
                onRun={(code) => {
                  setIdeCode(code);
                  setActiveWorkspaceTab('ide');
                  setIsWorkspaceOpen(true);
                }}
                onRegenerate={() => handleRegenerate(idx)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

          <ChatInput 
            input={input} 
            setInput={setInput} 
            onSubmit={handleSend} 
            onFileUploaded={handleFileUploaded}
            isLoading={isLoading} 
            onStop={handleStop} 
          />
        </main>
        
        {isWorkspaceOpen && (
          <aside className="workspace-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', background: 'var(--surface-hover)' }}>
            <div className="workspace-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <button className={`ws-tab ${activeWorkspaceTab === 'swarm' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('swarm')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeWorkspaceTab === 'swarm' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeWorkspaceTab === 'swarm' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <Activity size={16} /> Swarm View
              </button>
              <button className={`ws-tab ${activeWorkspaceTab === 'ide' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('ide')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeWorkspaceTab === 'ide' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeWorkspaceTab === 'ide' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <Code size={16} /> IDE
              </button>
              <button className={`ws-tab ${activeWorkspaceTab === 'data' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('data')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeWorkspaceTab === 'data' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeWorkspaceTab === 'data' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <Database size={16} /> Data Studio
              </button>
              <button className={`ws-tab ${activeWorkspaceTab === 'canvas' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('canvas')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeWorkspaceTab === 'canvas' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeWorkspaceTab === 'canvas' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <Code size={16} /> Preview
              </button>
              <button className={`ws-tab ${activeWorkspaceTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveWorkspaceTab('terminal')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeWorkspaceTab === 'terminal' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeWorkspaceTab === 'terminal' ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <TerminalIcon size={16} /> Terminal
              </button>
            </div>
            <div className="workspace-content" style={{ flex: 1, padding: '16px', overflow: 'hidden' }}>
              {activeWorkspaceTab === 'swarm' && <SwarmVisualizer activeAgent={activeAgent} activeTask={activeTask} />}
              {activeWorkspaceTab === 'ide' && <IdeWorkspace code={ideCode} onRun={async (c) => { 
                setIsIdeRunning(true);
                const r = await fetch('/api/run-python', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code: c }) });
                const d = await r.json();
                setIdeOutput(d.output || d.error);
                setIsIdeRunning(false);
              }} output={ideOutput} isExecuting={isIdeRunning} />}
              {activeWorkspaceTab === 'data' && <DataStudio chartData={chartData} />}
              {activeWorkspaceTab === 'canvas' && <CanvasWorkspace htmlCode={canvasCode} />}
              {activeWorkspaceTab === 'terminal' && <TerminalWorkspace files={projectFiles} />}
            </div>
          </aside>
        )}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onSave={setSettings} 
      />

      {isDataFilesOpen && (
        <div className="modal-overlay" onClick={() => setIsDataFilesOpen(false)}>
          <div className="modal-content data-files-modal" onClick={e => e.stopPropagation()} style={{ width: '80%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2>Data & Project Files</h2>
              <button className="btn-icon" onClick={() => setIsDataFilesOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.keys(projectFiles).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  No project files generated yet.
                </div>
              ) : (
                <div className="file-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(projectFiles).map(([filename, content]) => (
                    <div key={filename} className="file-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600 }}>{filename}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {
                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          a.click();
                        }}>Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn-primary" 
                disabled={Object.keys(projectFiles).length === 0}
                onClick={async () => {
                  const zip = new JSZip();
                  Object.entries(projectFiles).forEach(([name, data]) => {
                    zip.file(name, data);
                  });
                  const content = await zip.generateAsync({ type: 'blob' });
                  const url = URL.createObjectURL(content);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'jarvis_project.zip';
                  a.click();
                }}
              >
                Download Full Project (ZIP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
