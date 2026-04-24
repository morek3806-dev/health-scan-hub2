import { Link, useLocation } from "wouter";
import { 
  Home, 
  ShoppingCart, 
  PackageSearch, 
  Users, 
  Menu,
  Activity,
  Bell,
  ScanBarcode,
  Store,
  Stethoscope,
  HeartHandshake
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/stock", label: "Stock", icon: PackageSearch },
];

const peopleItems = [
  { href: "/customers", label: "Customers", icon: HeartHandshake },
  { href: "/suppliers", label: "Suppliers", icon: Store },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
];

const moreItems = [
  { href: "/insights", label: "Insights", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/scan", label: "Smart Scan", icon: ScanBarcode },
  { href: "/sales", label: "Sales History", icon: ShoppingCart },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card/50 backdrop-blur-sm p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2 px-2 mb-8 text-primary">
          <HeartHandshake className="h-6 w-6" />
          <span className="font-bold text-xl tracking-tight">Sunrise Pharmacy</span>
        </div>

        <nav className="flex-1 space-y-6">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Main</h4>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    location === item.href 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Network</h4>
            {peopleItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    location === item.href || location.startsWith(item.href + "/")
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">More</h4>
            {moreItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    location === item.href 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b sticky top-0 z-30">
        <div className="flex items-center gap-2 text-primary">
          <HeartHandshake className="h-5 w-5" />
          <span className="font-bold text-lg tracking-tight">Sunrise Pharmacy</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0 relative">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around p-2 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                "flex flex-col items-center justify-center w-16 py-1 rounded-lg transition-colors cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <item.icon className={cn("h-5 w-5 mb-1 transition-transform", isActive && "scale-110")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </span>
            </Link>
          );
        })}
        
        {/* People Sheet Trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <span className={cn(
              "flex flex-col items-center justify-center w-16 py-1 rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
              ["/customers", "/suppliers", "/doctors"].some(p => location.startsWith(p)) && "text-primary"
            )}>
              <Users className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">Network</span>
            </span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="mb-4">
              <SheetTitle>Network</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4">
              {peopleItems.map(item => (
                <Link key={item.href} href={item.href}>
                  <span className="flex flex-col items-center p-4 bg-muted rounded-xl cursor-pointer hover:bg-primary/10">
                    <item.icon className="h-6 w-6 mb-2 text-primary" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* More Sheet Trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <span className={cn(
              "flex flex-col items-center justify-center w-16 py-1 rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
              moreItems.some(item => location.startsWith(item.href)) && "text-primary"
            )}>
              <Menu className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">More</span>
            </span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="mb-4">
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4">
              {moreItems.map(item => (
                <Link key={item.href} href={item.href}>
                  <span className="flex flex-col items-center justify-center p-4 bg-muted rounded-xl cursor-pointer hover:bg-primary/10">
                    <item.icon className="h-6 w-6 mb-2 text-primary" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
