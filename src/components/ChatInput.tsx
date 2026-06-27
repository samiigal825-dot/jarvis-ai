'use client';

import React, { useRef, useState } from 'react';
import { Send, Square, Paperclip, Mic } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSubmit: (e?: React.FormEvent, promptOverride?: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({ input, setInput, onSubmit, isLoading, onStop }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e as any);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.extractedData) {
        const prompt = `I have uploaded a file named ${data.fileName}. Here is the extracted data:\\n\\n\`\`\`\\n${data.extractedData}\\n\`\`\`\\n\\nPlease analyze this data.`;
        onSubmit(undefined, prompt);
      } else {
        alert('File uploaded but could not extract text.');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="input-area">
      <form className="input-form" onSubmit={onSubmit}>
        <div className="input-upload">
          <input type="file" title="Upload File" onChange={handleFileUpload} disabled={isUploading || isLoading} />
          <button type="button" className="btn-icon" disabled={isUploading || isLoading}>
            {isUploading ? <span className="spin">⏳</span> : <Paperclip size={18} />}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Jarvis anything..."
          rows={1}
          disabled={isLoading || isUploading}
        />
        {isLoading ? (
          <button type="button" className="input-stop" onClick={onStop} title="Stop generation">
            <span className="stop-icon" />
          </button>
        ) : (
          <button type="submit" className="input-send" disabled={!input.trim() || isUploading} title="Send message">
            <Send size={18} />
          </button>
        )}
      </form>
      <div className="input-hint">Jarvis AI • Built with HuggingFace • Shift+Enter for new line</div>
    </div>
  );
}
