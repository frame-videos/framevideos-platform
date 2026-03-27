'use client';

interface UploadProgressProps {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  onCancel: () => void;
}

export default function UploadProgress({
  loaded,
  total,
  percentage,
  speed,
  timeRemaining,
  onCancel,
}: UploadProgressProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-primary-900 bg-opacity-30 border border-primary-700 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-primary-200 font-semibold">Fazendo upload...</p>
          <p className="text-primary-300 text-sm mt-1">
            {formatBytes(loaded)} de {formatBytes(total)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-400">{percentage}%</p>
          <p className="text-primary-300 text-xs">
            {formatBytes(speed)}/s
          </p>
        </div>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-primary-600 to-purple-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-primary-300">
          Tempo restante: <span className="font-semibold">{formatTime(timeRemaining)}</span>
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-red-400 hover:text-red-300 font-medium transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
