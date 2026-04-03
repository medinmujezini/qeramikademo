import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sofa, 
  Droplet, 
  Grid3X3, 
  Palette, 
  Columns, 
  FileCode, 
  Settings, 
  Activity,
  ArrowLeft,
  LogOut,
  ChevronRight,
  Database,
  Pipette,
  FileJson,
  Sparkles,
  Blinds,
  ChefHat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/scraper', label: 'Furniture Scraper', icon: Sparkles },
  { path: '/admin/furniture', label: 'Furniture', icon: Sofa },
  { path: '/admin/fixtures', label: 'Fixtures (MEP)', icon: Droplet },
  { path: '/admin/tiles', label: 'Tiles', icon: Grid3X3 },
  { path: '/admin/grout', label: 'Grout Colors', icon: Pipette },
  { path: '/admin/materials', label: 'Materials', icon: Palette },
  { path: '/admin/curtain-models', label: 'Curtain Models', icon: Blinds },
  { path: '/admin/kitchen-models', label: 'Kitchen Models', icon: ChefHat },
  { path: '/admin/columns', label: 'Columns', icon: Columns },
  { path: '/admin/plumbing-codes', label: 'Plumbing Codes', icon: FileCode },
  { path: '/admin/seed', label: 'Seed Data', icon: Database },
  { path: '/admin/import-export', label: 'Import / Export', icon: FileJson },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
  { path: '/admin/activity', label: 'Activity Log', icon: Activity },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-primary/12 flex flex-col relative z-10">
        {/* Logo/Header */}
        <div className="p-6 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center border border-primary/20">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-sm uppercase tracking-[0.15em] text-primary">Admin Panel</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Floor Plan Designer</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-none text-xs font-light uppercase tracking-[0.1em] transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-primary border-l-2 border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Gradient orb in sidebar bottom */}
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />

        {/* Footer */}
        <div className="p-4 border-t border-primary/10 space-y-2 relative z-10">
          <Button asChild variant="luxury" size="sm" className="w-full justify-start gap-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </Button>
          {user && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2 text-muted-foreground hover:text-primary"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative">
        {/* Gold gradient orb in bottom-left of main content */}
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />

        {/* Top Bar */}
        <header className="h-14 bg-card border-b border-primary/10 px-6 flex items-center justify-between relative z-10 overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-24 w-[350px] h-[180px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em]">
            <span className="text-muted-foreground font-light">Admin</span>
            <ChevronRight className="w-3 h-3 text-primary/30" />
            <span className="font-display text-primary">
              {navItems.find(item => isActive(item.path, item.exact))?.label || 'Dashboard'}
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-[10px] font-display uppercase text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tracking-wider">{user.email}</span>
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
