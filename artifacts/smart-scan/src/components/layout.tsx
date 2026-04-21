import React from 'react';
import { Link, useLocation } from 'wouter';
import { Pill, LayoutDashboard, ScanLine, Clock, AlertTriangle } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-b md:border-r border-sidebar-border flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            <Pill size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground leading-none tracking-tight">Smart Scan</h1>
            <p className="text-xs text-muted-foreground font-medium">Pharmacy Ops</p>
          </div>
        </div>

        <nav className="px-4 pb-6 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          <Link href="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${location === '/' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
            <LayoutDashboard size={18} />
            Inventory
          </Link>
          <Link href="/scan" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${location.startsWith('/scan') ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
            <ScanLine size={18} />
            Scan Bill
          </Link>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
