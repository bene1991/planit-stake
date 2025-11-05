import { Sidebar } from "@/components/Sidebar";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="relative flex-1 overflow-auto lg:ml-52">
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Content */}
        <div className="relative container mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
