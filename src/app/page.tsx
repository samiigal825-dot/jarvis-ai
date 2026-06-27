'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { Message, Conversation, Settings } from '@/types';
import { Menu, Moon, Sun, Bot } from 'lucide-react';

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
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      }

      // Check for Autonomous Tool Calls
      const searchMatch = fullContent.match(/\\[SEARCH:(.*?)\\]/);
      if (searchMatch && searchMatch[1]) {
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
          `[SYSTEM_TOOL_RESPONSE] Search Results for "${query}":\\n${searchResultText}\\n\\nPlease continue your answer based on these results.`,
          [...newMessages, assistantMsg]
        );
        return;
      }
      
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
      
      <main className="main">
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

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onSave={setSettings} 
      />
    </div>
  );
}
