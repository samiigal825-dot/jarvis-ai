'use client';

import React, { useRef, useState } from 'react';
import { Send, Square, Paperclip, Mic } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (e?: React.FormEvent, promptOverride?: string) => void;
  onFileUploaded: (fileName: string, extractedData: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({ input, setInput, onSubmit, onFileUploaded, isLoading, onStop }: ChatInputProps) {
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
        onFileUploaded(data.fileName, data.extractedData);
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

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome.');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setInput(prev => prev + (prev ? ' ' : '') + '🎙️ Listening...');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      // remove the listening text and add the actual transcript
      setInput(prev => prev.replace('🎙️ Listening...', '').trim() + (prev && !prev.endsWith('🎙️ Listening...') ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      setInput(prev => prev.replace('🎙️ Listening...', '').trim());
      console.error('Speech recognition error', event.error);
    };

    recognition.onend = () => {
      setInput(prev => prev.replace('🎙️ Listening...', '').trim());
    };

    recognition.start();
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
        <button type="button" className="btn-icon" onClick={handleVoiceInput} disabled={isLoading || isUploading} title="Voice Input" style={{ padding: '0 8px', color: 'var(--text-secondary)' }}>
          <Mic size={18} />
        </button>
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
