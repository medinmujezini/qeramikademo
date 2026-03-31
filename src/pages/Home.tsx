import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Wrench, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleCard } from '@/components/home/RoleCard';

const HomePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-display font-bold tracking-tight text-primary">SD</span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground tracking-wide">SanitariDraft</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Interior Design</span>
            </div>
          </div>
          
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground tracking-wider text-xs uppercase">
            <Link to="/admin">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Admin
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-32">
        {/* Hero Section */}
        <div className="text-center mb-20 max-w-3xl animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary/80 mb-6">Professional Interior Design</p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-foreground mb-6 leading-[1.05] tracking-tight">
            Transform Your
            <span className="text-primary block mt-2">Living Space</span>
          </h1>
          
          {/* Gold divider */}
          <div className="w-16 h-px bg-primary/40 mx-auto my-8" />
          
          <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto font-light">
            Professional interior design and planning tools made simple. 
            Design rooms, select finishes, and visualize in stunning 3D.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <RoleCard
            icon={Home}
            title="Design Your Space"
            subtitle="Homeowner"
            description="An intuitive platform to visualize and design your perfect bathroom or kitchen."
            features={[
              "Easy room layout drawing",
              "Browse tile & furniture catalogs",
              "Stunning 3D visualization",
              "Instant material quotes",
            ]}
            ctaText="Start Designing"
            to="/design"
            variant="primary"
          />

          <RoleCard
            icon={Wrench}
            title="Worker Platform"
            subtitle="Professional"
            description="Complete professional toolkit for contractors and designers with MEP planning."
            features={[
              "Advanced floor plan tools",
              "Complete plumbing design",
              "MEP systems planning",
              "Detailed labor estimation",
            ]}
            ctaText="Open Platform"
            to="/platform"
            variant="secondary"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-8 border-t border-border/30">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-3">
          <div className="w-10 h-px bg-primary/30" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
            © 2024 SanitariDraft — Professional Design Tools
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
