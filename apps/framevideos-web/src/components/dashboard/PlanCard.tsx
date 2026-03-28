import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  name: string;
  price: number;
  period: string;
  features: readonly string[];
  isCurrent?: boolean;
  isHighlighted?: boolean;
  loading?: boolean;
  onSelect?: () => void;
}

export function PlanCard({
  name,
  price,
  period,
  features,
  isCurrent = false,
  isHighlighted = false,
  loading = false,
  onSelect,
}: PlanCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-6 flex flex-col',
        isCurrent
          ? 'border-primary-600 bg-primary-600/5'
          : isHighlighted
            ? 'border-primary-600/50 bg-surface'
            : 'border-border bg-surface',
      )}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-4">
          <Badge variant="primary">Plano Atual</Badge>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">
            {price === 0 ? 'Grátis' : `$${price}`}
          </span>
          {price > 0 && (
            <span className="text-dark-400 text-sm">/{period}</span>
          )}
        </div>
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-dark-300">{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button variant="secondary" disabled className="w-full">
          Plano Atual
        </Button>
      ) : (
        <Button
          variant={isHighlighted ? 'primary' : 'outline'}
          className="w-full"
          loading={loading}
          onClick={onSelect}
        >
          {price === 0 ? 'Downgrade' : 'Fazer Upgrade'}
        </Button>
      )}
    </div>
  );
}
