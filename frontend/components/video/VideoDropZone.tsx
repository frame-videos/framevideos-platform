'use client';

import { useRef, useCallback, useState } from 'react';

interface VideoDropZoneProps {
  file: File | null;
  videoPreviewUrl: string;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
  uploading: boolean;
  validationErrors: string[];
}

const VALID_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv'];

export default function VideoDropZone({
  file,
  videoPreviewUrl,
  onFileSelect,
  onRemoveFile,
  uploading,
  validationErrors,
}: VideoDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-3">
        Arquivo de Vídeo *
      </label>
      
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-900 bg-opacity-20 scale-[1.02]'
            : 'border-gray-600 hover:border-gray-500'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="space-y-4">
            {videoPreviewUrl && (
              <div className="max-w-md mx-auto">
                <video
                  ref={videoPreviewRef}
                  src={videoPreviewUrl}
                  controls
                  className="w-full rounded-lg shadow-lg"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-4xl">🎬</div>
              <p className="text-white font-semibold text-lg">{file.name}</p>
              <p className="text-gray-400">{formatBytes(file.size)}</p>
              
              {!uploading && (
                <button
                  type="button"
                  onClick={onRemoveFile}
                  className="mt-3 text-red-400 hover:text-red-300 text-sm font-medium transition"
                >
                  ✕ Remover arquivo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-7xl">📁</div>
            <div>
              <p className="text-gray-300 text-lg mb-2">
                Arraste e solte seu vídeo aqui
              </p>
              <p className="text-gray-500 text-sm mb-4">ou</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
              >
                Escolher Arquivo
              </button>
            </div>
            <div className="pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                <strong>Formatos aceitos:</strong> MP4, MOV, AVI, MKV
              </p>
              <p className="text-gray-400 text-sm mt-1">
                <strong>Tamanho máximo:</strong> 500MB
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={VALID_EXTENSIONS.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={uploading}
      />

      {validationErrors.length > 0 && (
        <div className="mt-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4">
          <p className="text-red-200 font-semibold mb-2">⚠️ Erros de Validação:</p>
          <ul className="list-disc list-inside text-red-300 text-sm space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
