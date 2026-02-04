import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Home, BarChart3, Wallet, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const navItems = [
    { to: "/", label: "Início", icon: Home },
    { to: "/performance", label: "Desempenho", icon: BarChart3 },
    { to: "/bankroll", label: "Banca", icon: Wallet },
    { to: "/monthly-report", label: "Mensal", icon: CalendarDays },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto h-full px-4 lg:px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl lg:text-2xl font-bold">
              <span className="text-foreground">vini</span>
              <span className="text-primary">trader</span>
              <span className="text-primary text-2xl lg:text-3xl">.</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:text-primary relative",
                  isActive(item.to) ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className="h-4 w-4" />
                </div>
                {item.label}
                {isActive(item.to) && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            {user ? (
              <div className="hidden lg:flex items-center gap-3">
                <Link to="/account">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Conta
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Sair
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="hidden lg:block">
                <Button size="sm" className="bg-gradient-neon hover:shadow-glow-strong">
                  Entrar
                </Button>
              </Link>
            )}

            {/* Mobile Menu (Sheet for account/settings) */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-card border-l border-border/30">
                <div className="flex flex-col gap-6 mt-8">
                  {user && (
                    <>
                      <Link
                        to="/account"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-base font-medium text-muted-foreground hover:text-primary"
                      >
                        Conta
                      </Link>
                      <button
                        onClick={() => {
                          signOut();
                          setOpen(false);
                        }}
                        className="flex items-center gap-3 text-base font-medium text-destructive hover:text-destructive/80"
                      >
                        Sair
                      </button>
                    </>
                  )}
                  {!user && (
                    <Link
                      to="/auth"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 text-base font-medium text-primary"
                    >
                      Entrar
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 lg:pb-8">
        <div className="container mx-auto px-4 lg:px-6 py-6 lg:py-8 animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />
    </div>
  );
};
