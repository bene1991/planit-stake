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
    <Card className={cn("p-6 bg-card border-2 border-border/50 hover:border-primary/50 shadow-card hover:shadow-glow transition-all duration-300 animate-scale-in", className)}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
        {icon && (
          <div className="text-primary p-2 rounded-xl bg-primary/20">
            {icon}
          </div>
        )}
      </div>
      <p className="text-4xl font-bold mb-2 tracking-tight text-foreground">{value}</p>
      {detail && (
        <p className={cn(
          "text-sm font-semibold",
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
