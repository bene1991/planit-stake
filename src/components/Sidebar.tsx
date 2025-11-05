import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Calendar, BarChart3, User as UserIcon, LogOut, Radio } from "lucide-react";
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
    <aside className="h-full w-full bg-card shadow-sm">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          <VTLogo variant={variant} className="h-10 w-10" />
          <div>
            <h1 className="text-base font-bold text-foreground">Vini Trader</h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-primary" />
                )}
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t p-4 space-y-2">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Conectado como</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/account" className="flex-1" onClick={handleNavClick}>
              <Button variant="ghost" size="sm" className="w-full justify-start">
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
            className="w-full justify-start"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
};
