'use client';

import React from 'react';
import { BrainCircuit, FileCode, FileSpreadsheet, Sparkles, Image as ImageIcon, Search } from 'lucide-react';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

export function WelcomeScreen({ onPromptClick }: WelcomeScreenProps) {
  const capabilities = [
    { icon: <FileSpreadsheet size={14} />, text: 'Edit CSV & Excel' },
    { icon: <FileCode size={14} />, text: 'Write & Debug Code' },
    { icon: <ImageIcon size={14} />, text: 'Analyze Images' },
    { icon: <Search size={14} />, text: 'Web Search' },
    { icon: <BrainCircuit size={14} />, text: 'Complex Reasoning' },
  ];

  const prompts = [
    "I have a CSV file that needs data cleaning and formatting.",
    "Write a Python script to scrape a website and save as JSON.",
    "Analyze this image and extract all text from it.",
    "Help me design a new database schema for an e-commerce app.",
  ];

  return (
    <div className="welcome animate-fade-in">
      <div className="welcome-card">
        <div className="welcome-icon">🧠</div>
        <h1 className="welcome-title">Hi, I'm Jarvis.</h1>
        <p className="welcome-desc">
          Your personal CEO AI assistant. I can write code, analyze data, edit files, and solve complex problems. What can I do for you today?
        </p>
        
        <div className="welcome-chips">
          {capabilities.map((cap, i) => (
            <div key={i} className="welcome-chip">
              {cap.icon} {cap.text}
            </div>
          ))}
        </div>

        <div className="welcome-prompts">
          {prompts.map((prompt, i) => (
            <button 
              key={i} 
              className="welcome-prompt"
              onClick={() => onPromptClick(prompt)}
            >
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
