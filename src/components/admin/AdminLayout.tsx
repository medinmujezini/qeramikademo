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
  Sparkles
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
      {/* Background gradient orbs */}
      <div className="gradient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>
      {/* Glass Sidebar */}
      <aside className="w-64 glass-sidebar border-r border-border/50 flex flex-col relative z-10">
        {/* Logo/Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
              <Settings className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Floor Plan Designer</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 space-y-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </Button>
          {user && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Glass Top Bar */}
        <header className="h-14 bg-card/80 backdrop-blur-lg border-b border-border/50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Admin</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {navItems.find(item => isActive(item.path, item.exact))?.label || 'Dashboard'}
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <span className="text-xs font-medium text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
