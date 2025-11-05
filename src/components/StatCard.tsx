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
    <Card className={cn("p-6 border border-border shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </p>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      {detail && (
        <p className={cn(
          "text-xs",
          trend === 'up' && "text-green-600",
          trend === 'down' && "text-red-600",
          trend === 'neutral' && "text-muted-foreground"
        )}>
          {detail}
        </p>
      )}
    </Card>
  );
}
