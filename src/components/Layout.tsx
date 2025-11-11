import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Header with Hamburger */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-4 border-b bg-card/80 backdrop-blur-xl px-6 lg:hidden shadow-apple-sm">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <Sidebar onItemClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-base font-semibold tracking-tight">Vini Trader</h1>
      </header>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-64 border-r bg-card/50 backdrop-blur-xl shadow-apple">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="relative flex-1 overflow-auto pt-16 lg:pt-0 lg:ml-64">
        {/* Content */}
        <div className="relative container mx-auto px-6 py-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
