'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TrendingChartProps {
  data: {
    title: string;
    views: number;
  }[];
}

export function TrendingChart({ data }: TrendingChartProps) {
  const chartData = {
    labels: data.map(item => {
      // Truncate long titles
      return item.title.length > 20 
        ? item.title.substring(0, 20) + '...' 
        : item.title;
    }),
    datasets: [
      {
        label: 'Views',
        data: data.map(item => item.views),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function(context: any) {
            const index = context[0].dataIndex;
            return data[index].title;
          }
        }
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return value.toLocaleString();
          }
        }
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Top 10 Trending Videos
      </h3>
      <div className="h-96">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
