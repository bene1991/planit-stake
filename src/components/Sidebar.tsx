import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Calendar, BarChart3, User as UserIcon, LogOut, Radio, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLogo } from "@/contexts/LogoContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VTLogo } from "@/components/VTLogo";

interface SidebarProps {
  onItemClick?: () => void;
}

export const Sidebar = ({ onItemClick }: SidebarProps = {}) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { variant } = useLogo();

  const navItems = [
    { path: "/bankroll", label: "Gestão de Banca", icon: TrendingUp },
    { path: "/", label: "Planejamento Diário", icon: Calendar },
    { path: "/live", label: "Jogos Ao Vivo", icon: Radio },
    { path: "/statistics", label: "Estatísticas", icon: BarChart3 },
  ];

  const handleNavClick = () => {
    onItemClick?.();
  };

  return (
    <aside className="h-full w-full bg-transparent">
      <div className="flex h-full flex-col p-4">
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 px-2 mb-4">
          <VTLogo variant={variant} className="h-12 w-12" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Vini Trader</h1>
            <p className="text-xs text-muted-foreground font-light">Sistema de Gestão</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-apple-md"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )} />
                <span className="tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-border/50 pt-4 space-y-2 mt-4">
          <div className="px-3 py-2 rounded-xl bg-secondary/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Conectado como</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/account" className="flex-1" onClick={handleNavClick}>
              <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl">
                <UserIcon className="mr-2 h-4 w-4" />
                Conta
              </Button>
            </Link>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              signOut();
              handleNavClick();
            }} 
            className="w-full justify-start rounded-xl hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
};
