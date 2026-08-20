"use client";

import { useRef, type KeyboardEvent } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  isLoading: boolean;
}

export default function MessageInput({ value, onChange, onSubmit, isLoading }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="shrink-0 border-t border-midnight-tide bg-forest-depths px-6 py-4">
      <div className="max-w-3xl mx-auto flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Pregúntame sobre coches..."
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none bg-shadow-teal/50 border border-midnight-tide rounded-xl px-4 py-3 text-sm text-pure-light placeholder:text-mist-gray/40 focus:outline-none focus:border-mint-glow/40 transition-colors disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className="shrink-0 w-11 h-11 rounded-xl bg-mint-glow text-forest-depths flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 10L17 3L13 17L10 12L3 10Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="text-[11px] text-mist-gray/30 text-center mt-2">
        Enter para enviar · Shift+Enter nueva línea
      </p>
    </div>
  );
}
