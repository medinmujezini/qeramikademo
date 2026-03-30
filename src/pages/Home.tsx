import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Wrench, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleCard } from '@/components/home/RoleCard';

const HomePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <div className="w-4 h-4 rounded bg-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">SanitariDraft</span>
          </div>
          
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/admin">
              <Shield className="h-4 w-4 mr-1.5" />
              Admin
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-14 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Transform Your
            <span className="text-primary block mt-1">Living Space</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Professional interior design and planning tools made simple. 
            Design rooms, select finishes, and visualize in stunning 3D.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
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
      <footer className="py-6 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 SanitariDraft. Professional design tools.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
