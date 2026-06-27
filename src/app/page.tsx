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

  const handleSend = async (e?: React.FormEvent, promptOverride?: string) => {
    e?.preventDefault();
    const text = promptOverride || input;
    if (!text.trim() || isLoading) return;

    setInput('');
    setIsLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Ensure we have an active conversation
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
          model: settings.defaultModel
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(await response.text());
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value, { stream: true });
        assistantMsg.content += text;
        
        setMessages(prev => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...assistantMsg };
          return arr;
        });
      }
      
      // Update conversation in sidebar
      setConversations(prev => prev.map(c => 
        c.id === activeId ? { ...c, messages: [...newMessages, assistantMsg], updatedAt: Date.now() } : c
      ));

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: '⚠️ **Error:** Failed to connect to AI engine. ' + err.message, 
          timestamp: Date.now() 
        }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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
              <span className="chat-header-badge">HuggingFace Engine</span>
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
