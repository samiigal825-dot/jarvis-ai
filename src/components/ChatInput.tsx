'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Square, Paperclip, Mic } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({ input, setInput, onSubmit, isLoading, onStop }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e as any);
      }
    }
  };

  return (
    <div className="input-area">
      <form className="input-form" onSubmit={onSubmit}>
        <div className="input-upload">
          <input type="file" title="Upload File" />
          <button type="button" className="btn-icon"><Paperclip size={18} /></button>
        </div>
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Jarvis anything..."
          rows={1}
        />
        {isLoading ? (
          <button type="button" className="input-stop" onClick={onStop} title="Stop generation">
            <span className="stop-icon" />
          </button>
        ) : (
          <button type="submit" className="input-send" disabled={!input.trim()} title="Send message">
            <Send size={18} />
          </button>
        )}
      </form>
      <div className="input-hint">Jarvis AI • Built with HuggingFace • Shift+Enter for new line</div>
    </div>
  );
}
