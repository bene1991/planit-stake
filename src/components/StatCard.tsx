import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, detail, trend, icon, className }: StatCardProps) {
  return (
    <Card className={cn("p-6 bg-gradient-to-br from-card to-card/50 border-0 shadow-apple hover:shadow-apple-lg transition-all duration-300 animate-scale-in", className)}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="text-primary/70 p-2 rounded-xl bg-primary/10">
            {icon}
          </div>
        )}
      </div>
      <p className="text-4xl font-bold mb-2 tracking-tight">{value}</p>
      {detail && (
        <p className={cn(
          "text-xs font-medium",
          trend === 'up' && "text-success",
          trend === 'down' && "text-destructive",
          trend === 'neutral' && "text-muted-foreground"
        )}>
          {detail}
        </p>
      )}
    </Card>
  );
}
