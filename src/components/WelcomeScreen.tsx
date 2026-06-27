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
    "Run full data deduplication and analysis on the Q3 Financials CSV.",
    "Initialize the Enterprise Swarm Protocol to draft a technical spec.",
    "Conduct a real-time web search for current market conditions.",
    "Debug the attached Python script and optimize for performance.",
  ];

  return (
    <div className="welcome animate-fade-in">
      <div className="welcome-card">
        <div className="welcome-icon" style={{filter: 'drop-shadow(0 0 10px var(--primary))'}}>🌐</div>
        <h1 className="welcome-title" style={{letterSpacing: '-0.03em'}}>JARVIS Enterprise Workspace</h1>
        <p className="welcome-desc">
          Autonomous CEO & Multi-Agent Swarm Platform. Ready to orchestrate data pipelines, execute code, and perform deep analytical reasoning.
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
