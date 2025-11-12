interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-neon-subtle mb-6 border border-border/30">
        <div className="text-primary">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}
