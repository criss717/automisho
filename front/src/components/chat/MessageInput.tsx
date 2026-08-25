"use client";

import { useRef, useState, type KeyboardEvent, type DragEvent, type ChangeEvent } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, files?: FileList, searchMode?: "standard" | "deep") => void;
  isLoading: boolean;
}

export default function MessageInput({ value, onChange, onSubmit, isLoading }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; name: string; isPdf: boolean; sizeKb: number } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [searchMode, setSearchMode] = useState<"standard" | "deep">("standard");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && !selectedFiles) || isLoading) return;
    onSubmit(trimmed, selectedFiles ?? undefined, searchMode);
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
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) return;

    setSelectedFiles(files);
    const sizeKb = Math.round(file.size / 1024);

    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreview({ url, name: file.name, isPdf: false, sizeKb });
    } else {
      setPreview({ url: null, name: file.name, isPdf: true, sizeKb });
    }
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
      className={`shrink-0 border-t bg-forest-depths/95 backdrop-blur-md px-3 sm:px-4 py-3 transition-colors ${
        dragOver ? "border-mint-glow bg-mint-glow/5" : "border-midnight-tide"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {preview && (
        <div className="w-full max-w-2xl mx-auto mb-2.5 flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-midnight-tide/80 border border-mint-glow/30">
          <div className="flex items-center gap-3 min-w-0">
            {preview.isPdf ? (
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <span className="text-rose-400 font-bold text-xs">PDF</span>
              </div>
            ) : preview.url ? (
              <img src={preview.url} alt="Preview" className="w-10 h-10 rounded-xl object-cover border border-midnight-tide shrink-0" />
            ) : null}

            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-medium text-pure-light truncate">{preview.name}</span>
              <span className="text-[10px] text-mist-gray/70">
                {preview.isPdf ? `Documento PDF (${preview.sizeKb} KB) listo para auditoría` : `Imagen (${preview.sizeKb} KB)`}
              </span>
            </div>
          </div>

          <button
            onClick={clearPreview}
            className="w-7 h-7 rounded-full bg-forest-depths border border-white/10 flex items-center justify-center text-mist-gray hover:text-rose-400 text-sm shrink-0 transition-colors"
            title="Eliminar archivo adjunto"
          >
            ×
          </button>
        </div>
      )}

      {/* Search Mode Pill Switch */}
      <div className="w-full max-w-2xl mx-auto mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 bg-midnight-tide/60 p-0.5 rounded-full border border-white/5 text-[11px]">
          <button
            type="button"
            onClick={() => setSearchMode("standard")}
            className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 ${
              searchMode === "standard"
                ? "bg-mint-glow text-forest-depths font-semibold shadow-sm"
                : "text-mist-gray/60 hover:text-pure-light"
            }`}
            title="Escanea hasta 50 coches en AutoScout24 y Coches.net (~2.5s)"
          >
            <span>⚡</span>
            <span>Estándar (50 coches)</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("deep")}
            className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 ${
              searchMode === "deep"
                ? "bg-mint-glow text-forest-depths font-semibold shadow-sm"
                : "text-mist-gray/60 hover:text-pure-light"
            }`}
            title="Escanea hasta 100 coches en AutoScout24, Coches.net, Wallapop y Milanuncios (~5s)"
          >
            <span>🔍</span>
            <span>Profunda (100 coches + Wallapop/Milanuncios)</span>
          </button>
        </div>

        <span className="text-[10px] text-mist-gray/40 hidden md:inline">
          {searchMode === "standard" ? "Rápida (~2.5s)" : "Multi-portal (~5s)"}
        </span>
      </div>

      <div className="w-full max-w-2xl mx-auto flex gap-2 items-end">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="shrink-0 w-10 h-10 rounded-xl border border-midnight-tide bg-shadow-teal/30 text-mist-gray hover:text-mint-glow hover:border-mint-glow/30 flex items-center justify-center transition-all disabled:opacity-30 group"
          title="Adjuntar PDF (informe DGT, ITV, CarVertical) o imagen del coche"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="group-hover:scale-105 transition-transform">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Pregúntame sobre coches, sube un PDF (DGT/ITV) o dime qué te dijo el vendedor..."
          rows={1}
          disabled={isLoading}
          className="flex-1 min-h-[42px] max-h-[120px] resize-none bg-shadow-teal/40 border border-midnight-tide rounded-xl px-3.5 py-2.5 text-sm text-pure-light placeholder:text-mist-gray/40 focus:outline-none focus:border-mint-glow/40 transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleSubmit}
          disabled={(!value.trim() && !selectedFiles) || isLoading}
          className="shrink-0 w-10 h-10 rounded-xl bg-mint-glow text-forest-depths flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(151,252,215,0.4)] transition-all font-semibold"
          title="Enviar mensaje"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
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

      <p className="text-[10px] text-mist-gray/40 text-center mt-1.5 hidden sm:block">
        Enter para enviar · Shift+Enter para nueva línea · Arrastra PDFs de la DGT o imágenes aquí
      </p>
    </div>
  );
}
