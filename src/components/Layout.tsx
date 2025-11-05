import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Calendar, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const navItems = [
    { path: "/bankroll", label: "Gestão de Banca", icon: TrendingUp },
    { path: "/", label: "Planejamento Diário", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">J360</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">J360 Banca & Planejamento</h1>
                <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden md:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              <div className="ml-4 flex items-center gap-2 border-l pl-4">
                <span className="hidden text-sm text-muted-foreground md:inline">
                  {user?.email}
                </span>
                <Link to="/account">
                  <Button variant="ghost" size="sm">
                    <UserIcon className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Conta</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
