import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: ReactNode;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconColor = 'bg-primary-600/20 text-primary-400',
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconColor)}>
          {icon}
        </div>
        {change && (
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              changeType === 'positive' && 'bg-green-600/20 text-green-400',
              changeType === 'negative' && 'bg-red-600/20 text-red-400',
              changeType === 'neutral' && 'bg-dark-600/50 text-dark-300',
            )}
          >
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-dark-400 mt-1">{title}</p>
    </div>
  );
}
