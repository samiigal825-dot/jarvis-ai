'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { Message, Conversation, Settings } from '@/types';
import { Menu, Moon, Sun, Bot, Activity, Code, Database } from 'lucide-react';
import { SwarmVisualizer } from '@/components/SwarmVisualizer';
import { IdeWorkspace } from '@/components/IdeWorkspace';
import { DataStudio } from '@/components/DataStudio';
import { CanvasWorkspace } from '@/components/CanvasWorkspace';

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

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'swarm' | 'ide' | 'data' | 'canvas'>('swarm');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [activeAgent, setActiveAgent] = useState('None');
  const [ideCode, setIdeCode] = useState('print("Hello from JARVIS CEO!")');
  const [ideOutput, setIdeOutput] = useState('');
  const [isIdeRunning, setIsIdeRunning] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [canvasCode, setCanvasCode] = useState('');

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
      
      const response = await fetch('/api/chat', {
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

        // Live extract HTML for Canvas
        const fileMatch = fullContent.match(/\[GENERATE_FILE:([^\]]+\.(html|htm))\]([\s\S]*?)(?:\[\/GENERATE_FILE\]|$)/i);
        if (fileMatch && fileMatch[3]) {
          setCanvasCode(fileMatch[3].trim());
          if (activeWorkspaceTab !== 'canvas') {
            setActiveWorkspaceTab('canvas');
            setIsWorkspaceOpen(true);
          }
        }
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
            </div>
            <div className="workspace-content" style={{ flex: 1, padding: '16px', overflow: 'hidden' }}>
              {activeWorkspaceTab === 'swarm' && <SwarmVisualizer activeAgent={activeAgent} />}
              {activeWorkspaceTab === 'ide' && <IdeWorkspace code={ideCode} onRun={async (c) => { 
                setIsIdeRunning(true);
                const r = await fetch('/api/run-python', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ code: c }) });
                const d = await r.json();
                setIdeOutput(d.output || d.error);
                setIsIdeRunning(false);
              }} output={ideOutput} isExecuting={isIdeRunning} />}
              {activeWorkspaceTab === 'data' && <DataStudio chartData={chartData} />}
              {activeWorkspaceTab === 'canvas' && <CanvasWorkspace htmlCode={canvasCode} />}
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
    </div>
  );
}
