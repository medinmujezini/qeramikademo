import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Wrench, Cuboid, Scan, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleCard } from '@/components/home/RoleCard';

const HomePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Gradient mesh background for glass blur visibility - Enhanced */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, hsl(217 91% 60% / 0.15) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 30%, hsl(190 80% 50% / 0.10) 0%, transparent 55%),
            radial-gradient(ellipse at 60% 70%, hsl(260 70% 60% / 0.10) 0%, transparent 55%),
            radial-gradient(ellipse at 30% 80%, hsl(170 70% 50% / 0.08) 0%, transparent 55%),
            hsl(222 47% 11%)
          `
        }}
      />
      
      {/* Background gradient orbs */}
      <div className="gradient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      {/* Header */}
      <header className="px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="glass glass-pill glass-shine-sweep px-6 py-3 flex items-center justify-between">
            <div className="shine-layer" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <div className="w-6 h-6 rounded-lg bg-primary" />
              </div>
              <span className="text-xl font-bold text-foreground">SanitariDraft</span>
            </div>
            
            <div className="flex items-center gap-2 relative z-10">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/cornell">
                  <Cuboid className="h-4 w-4 mr-1.5" />
                  Cornell
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/raytracing">
                  <Scan className="h-4 w-4 mr-1.5" />
                  Raytracing
                </Link>
              </Button>
              <div className="w-px h-6 bg-border/50 mx-2" />
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-1.5" />
                  Admin
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16 max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Transform Your
            <span className="text-primary block">Living Space</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Professional interior design and planning tools made simple. 
            Design rooms, select finishes, and visualize in stunning 3D.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full">
          <RoleCard
            icon={Home}
            title="Design Your Space"
            subtitle="Homeowner"
            description="An intuitive platform to visualize and design your perfect bathroom or kitchen. Browse tiles, place furniture, and get instant quotes."
            features={[
              "Easy room layout drawing",
              "Browse tile & furniture catalogs",
              "Stunning 3D visualization",
              "Instant material quotes",
              "Export shopping lists"
            ]}
            ctaText="Start Designing"
            to="/design"
            variant="primary"
          />

          <RoleCard
            icon={Wrench}
            title="Worker Platform"
            subtitle="Professional"
            description="Complete professional toolkit for contractors and designers. Full MEP planning, code compliance, and detailed project estimation."
            features={[
              "Advanced floor plan tools",
              "Complete plumbing design",
              "MEP systems planning",
              "Code compliance checking",
              "Detailed labor estimation"
            ]}
            ctaText="Open Platform"
            to="/platform"
            variant="secondary"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <p>© 2024 SanitariDraft. Professional design tools.</p>
          <div className="flex items-center gap-4">
            <Link to="/cornell" className="hover:text-foreground transition-colors">Cornell Box Demo</Link>
            <Link to="/raytracing" className="hover:text-foreground transition-colors">Raytracing Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
