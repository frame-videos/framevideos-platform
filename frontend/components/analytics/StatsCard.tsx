import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, description }: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {trend && (
            <p className={`mt-2 text-sm flex items-center ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span className="font-medium">
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">vs last period</span>
            </p>
          )}
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        <div className="ml-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
            <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
