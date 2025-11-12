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
    <Card className={cn("p-6 bg-card border border-border/30 hover:border-primary/30 shadow-card hover:shadow-neon transition-all duration-300 animate-scale-in group", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="text-primary p-2 rounded-lg bg-gradient-neon-subtle group-hover:bg-primary/10 transition-colors">
            {icon}
          </div>
        )}
      </div>
      <p className="text-4xl font-bold mb-2 tracking-tight text-foreground group-hover:text-primary transition-colors">{value}</p>
      {detail && (
        <p className={cn(
          "text-sm font-semibold",
          trend === 'up' && "text-primary",
          trend === 'down' && "text-destructive",
          trend === 'neutral' && "text-muted-foreground"
        )}>
          {detail}
        </p>
      )}
    </Card>
  );
}
