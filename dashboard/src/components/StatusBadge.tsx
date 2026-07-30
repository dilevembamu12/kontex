/// @anchor: Composant StatusBadge — badge d'état (healthy/degraded/unhealthy).

interface StatusBadgeProperties {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
}

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-green-500/10 text-green-400 border-green-500/30',
  degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  unhealthy: 'bg-red-500/10 text-red-400 border-red-500/30',
} as const;

const STATUS_LABELS: Record<string, string> = {
  healthy: '✓ Sain',
  degraded: '⚠ Dégradé',
  unhealthy: '✗ Critique',
} as const;

export function StatusBadge({ status }: StatusBadgeProperties) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
