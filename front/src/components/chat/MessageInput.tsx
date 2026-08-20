"use client";

import { useRef, useState, type KeyboardEvent, type DragEvent, type ChangeEvent } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, files?: FileList) => void;
  isLoading: boolean;
}

export default function MessageInput({ value, onChange, onSubmit, isLoading }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && !selectedFiles) || isLoading) return;
    onSubmit(trimmed, selectedFiles ?? undefined);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setPreview(null);
    setSelectedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    setSelectedFiles(files);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const clearPreview = () => {
    setPreview(null);
    setSelectedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      className={`shrink-0 border-t bg-forest-depths px-6 py-4 transition-colors ${dragOver ? "border-mint-glow bg-mint-glow/5" : "border-midnight-tide"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {preview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-3">
          <div className="relative">
            <img src={preview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-midnight-tide" />
            <button
              onClick={clearPreview}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-midnight-tide border border-mist-gray/30 flex items-center justify-center text-mist-gray hover:text-pure-light text-xs"
            >
              ×
            </button>
          </div>
          <span className="text-xs text-mist-gray/60">Imagen lista para enviar con tu mensaje</span>
        </div>
      )}
      <div className="max-w-3xl mx-auto flex gap-3 items-end">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="shrink-0 w-10 h-10 rounded-xl border border-midnight-tide bg-shadow-teal/30 text-mist-gray hover:text-mint-glow hover:border-mint-glow/30 flex items-center justify-center transition-all disabled:opacity-30"
          title="Adjuntar imagen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <circle cx="11" cy="10" r="3" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Pregúntame sobre coches... (arrastra imagen aquí)"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none bg-shadow-teal/50 border border-midnight-tide rounded-xl px-4 py-3 text-sm text-pure-light placeholder:text-mist-gray/40 focus:outline-none focus:border-mint-glow/40 transition-colors disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={(!value.trim() && !selectedFiles) || isLoading}
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
        Enter para enviar · Shift+Enter nueva línea · Arrastra imagen o click en 📎
      </p>
    </div>
  );
}
