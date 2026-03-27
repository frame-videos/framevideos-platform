'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Formato de arquivo inválido. Use MP4, WebM, OGG ou MOV.');
      return;
    }

    if (selectedFile.size > 500 * 1024 * 1024) { // 500MB
      setError('Arquivo muito grande. Máximo: 500MB');
      return;
    }

    setFile(selectedFile);
    setError('');
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    if (!title.trim()) {
      setError('Digite um título para o vídeo');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          router.push('/dashboard');
        } else {
          setError('Falha ao fazer upload');
          setUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Erro de conexão');
        setUploading(false);
      });

      xhr.open('POST', '/api/v1/videos/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary-400 hover:text-primary-300 flex items-center"
          >
            ← Voltar ao Dashboard
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <h1 className="text-3xl font-bold text-white mb-8">Upload de Vídeo</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Título do Vídeo
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Digite o título do vídeo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Arquivo de Vídeo
              </label>
              
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                  dragActive
                    ? 'border-primary-500 bg-primary-900 bg-opacity-20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="space-y-2">
                    <div className="text-5xl">📹</div>
                    <p className="text-white font-semibold">{file.name}</p>
                    <p className="text-gray-400 text-sm">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remover arquivo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-6xl">📁</div>
                    <div>
                      <p className="text-gray-300 mb-2">
                        Arraste e solte seu vídeo aqui
                      </p>
                      <p className="text-gray-400 text-sm mb-4">ou</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition"
                      >
                        Escolher Arquivo
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs">
                      Formatos aceitos: MP4, WebM, OGG, MOV (máx. 500MB)
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Fazendo upload...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              {uploading ? 'Fazendo Upload...' : 'Fazer Upload'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
