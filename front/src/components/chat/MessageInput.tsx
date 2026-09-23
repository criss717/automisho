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
  const [preview, setPreview] = useState<{ url: string | null; name: string; isPdf: boolean; sizeKb: number } | null>(null);
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
      className={`shrink-0 border-t bg-paper/95 backdrop-blur-md px-3 sm:px-4 py-3 transition-colors ${
        dragOver ? "border-signal-blue bg-linen" : "border-mist"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {preview && (
        <div className="w-full max-w-2xl mx-auto mb-2.5 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-linen border border-mist">
          <div className="flex items-center gap-3 min-w-0">
            {preview.isPdf ? (
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <span className="text-rose-600 font-bold text-xs">PDF</span>
              </div>
            ) : preview.url ? (
              <img src={preview.url} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-mist shrink-0" />
            ) : null}

            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-medium text-graphite truncate">{preview.name}</span>
              <span className="text-[10px] text-ash">
                {preview.isPdf ? `Documento PDF (${preview.sizeKb} KB) listo para auditoría` : `Imagen (${preview.sizeKb} KB)`}
              </span>
            </div>
          </div>

          <button
            onClick={clearPreview}
            className="w-7 h-7 rounded-full bg-paper border border-mist flex items-center justify-center text-ash hover:text-rose-600 text-sm shrink-0 transition-colors"
            title="Eliminar archivo adjunto"
          >
            ×
          </button>
        </div>
      )}

      {/* Multi-portal Active Status */}
      <div className="w-full max-w-2xl mx-auto mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[11px] text-ash font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Búsqueda profunda activa en portales: Coches.net, Milanuncios, Wallapop y AutoScout24</span>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto flex gap-2 items-end">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="shrink-0 w-10 h-10 rounded-xl border border-mist bg-linen text-ash hover:text-signal-blue hover:border-signal-blue flex items-center justify-center transition-all disabled:opacity-30 group"
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
          className="flex-1 min-h-[42px] max-h-[120px] resize-none bg-linen border border-mist rounded-xl px-3.5 py-2.5 text-sm text-graphite placeholder:text-ash focus:outline-none focus:border-signal-blue transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleSubmit}
          disabled={(!value.trim() && !selectedFiles) || isLoading}
          className="btn-primary shrink-0 w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all font-semibold"
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

      <p className="text-[10px] text-ash text-center mt-1.5 hidden sm:block">
        Enter para enviar · Shift+Enter para nueva línea · Arrastra PDFs de la DGT o imágenes aquí
      </p>
    </div>
  );
}
