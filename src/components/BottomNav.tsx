import { Link, useLocation } from "react-router-dom";
import { Home, BarChart3, Wallet, FlaskConical, CalendarDays, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Início", icon: Home },
    { to: "/performance", label: "Desemp.", icon: BarChart3 },
    { to: "/bankroll", label: "Banca", icon: Wallet },
    { to: "/monthly-report", label: "Mensal", icon: CalendarDays },
    { to: "/method-analysis", label: "Análise", icon: FlaskConical },
    { to: "/lay-0x1", label: "Lay 0x1", icon: Target },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
      <div className="grid grid-cols-6 h-16 px-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-all duration-200 min-w-0",
              isActive(item.to) 
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium truncate whitespace-nowrap max-w-full max-[340px]:hidden">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
