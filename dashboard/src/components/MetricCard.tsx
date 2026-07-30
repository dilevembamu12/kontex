/// @anchor: Composant MetricCard — affiche une métrique TTC avec titre, valeur et tendance.

interface MetricCardProperties {
  readonly title: string;
  readonly value: string | number;
  readonly description: string;
  readonly trend?: 'up' | 'down' | 'stable';
  readonly color?: 'purple' | 'green' | 'red' | 'blue' | 'yellow';
}

const COLOR_CLASSES: Record<string, string> = {
  purple: 'border-purple-500/30 bg-purple-500/5',
  green: 'border-green-500/30 bg-green-500/5',
  red: 'border-red-500/30 bg-red-500/5',
  blue: 'border-blue-500/30 bg-blue-500/5',
  yellow: 'border-yellow-500/30 bg-yellow-500/5',
} as const;

const TREND_ICONS: Record<string, string> = {
  up: '↗️',
  down: '↘️',
  stable: '→',
} as const;

export function MetricCard({ title, value, description, trend, color = 'purple' }: MetricCardProperties) {
  return (
    <div className={`rounded-xl border p-5 ${COLOR_CLASSES[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">{title}</p>
        {trend && <span className="text-sm">{TREND_ICONS[trend]}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}
