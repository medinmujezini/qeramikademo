import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthProvider } from '@/contexts/AuthContext';
import { FloorPlanTab } from '@/components/tabs/FloorPlanTab';
import { TilesTab } from '@/components/tabs/TilesTab';
import { DesignTab } from '@/components/tabs/DesignTab';
import { BackToHome } from '@/components/home/BackToHome';
import { 
  PenTool, 
  Grid2X2, 
  Palette,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import type { WallTileSection } from '@/types/floorPlan';

const EndUserPlatform = () => {
  const [activeTab, setActiveTab] = useState('floor-plan');
  const [pendingWallTileId, setPendingWallTileId] = useState<string | null>(null);
  const [animatingWallId, setAnimatingWallId] = useState<string | null>(null);

  const handleOpenTilesTab = useCallback((wallId: string) => {
    setPendingWallTileId(wallId);
    setActiveTab('tiles');
  }, []);

  const handleTileApplyComplete = useCallback((wallId: string, tileSettings: WallTileSection) => {
    setAnimatingWallId(wallId);
    setPendingWallTileId(null);
    setActiveTab('design');
    
    setTimeout(() => {
      setAnimatingWallId(null);
    }, 5000);
  }, []);

  return (
    <AuthProvider>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <header className="bg-card px-6 h-16 flex items-center justify-between relative z-10 overflow-hidden shimmer-border-bottom" style={{ borderBottom: 'none' }}>
          <div className="pointer-events-none absolute -top-16 -right-24 w-[350px] h-[180px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-12 -left-20 w-[280px] h-[150px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.05)_0%,transparent_60%)]" />
          <div className="flex items-center gap-3">
            <BackToHome />
            <div className="w-px h-5 bg-primary/15" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary/50 animate-pulse" />
              <span className="font-display text-xs uppercase tracking-[0.15em] text-primary gold-text-glow">Design Studio</span>
            </div>
          </div>
          
          <Button variant="luxury" size="sm" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Cart
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
          {/* Tab Navigation */}
          <div className="bg-card flex flex-col justify-center px-4 relative overflow-hidden shimmer-border-bottom" style={{ minHeight: '3rem' }}>
            <div className="gold-accent-line w-full absolute top-0 left-0" />
            <div className="pointer-events-none absolute -top-10 -right-16 w-[200px] h-[120px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.05)_0%,transparent_70%)]" />
            <div className="pointer-events-none absolute -bottom-8 -left-16 w-[180px] h-[100px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.04)_0%,transparent_70%)]" />
            <TabsList className="h-12">
              <TabsTrigger value="floor-plan" className="gap-1.5">
                <PenTool className="h-3.5 w-3.5" />
                Room Layout
              </TabsTrigger>
              <TabsTrigger value="tiles" className="gap-1.5">
                <Grid2X2 className="h-3.5 w-3.5" />
                Finishes
              </TabsTrigger>
              <TabsTrigger value="design" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                3D View
              </TabsTrigger>
              <TabsTrigger value="quote" className="gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />
                Quote
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="floor-plan" className="flex-1 m-0">
            <FloorPlanTab />
          </TabsContent>
          <TabsContent value="tiles" className="flex-1 m-0">
            <TilesTab 
              pendingWallId={pendingWallTileId}
              onApplyComplete={handleTileApplyComplete}
            />
          </TabsContent>
          <TabsContent value="design" className="flex-1 m-0">
            <DesignTab 
              onOpenTilesTab={handleOpenTilesTab}
              animatingWallId={animatingWallId}
            />
          </TabsContent>
          <TabsContent value="quote" className="flex-1 m-0">
            <QuoteTab />
          </TabsContent>
        </Tabs>
      </div>
    </AuthProvider>
  );
};

const QuoteTab = () => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-none bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/20 relative overflow-hidden">
            <ShoppingCart className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Your Project Quote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            <p className="mb-3">
              Complete your room design to generate an instant quote with materials and pricing.
            </p>
            <p className="text-sm">
              Add tiles to walls and place furniture in the Design tab to see your quote here.
            </p>
          </div>
          
          <div className="border-t border-border pt-5">
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Estimated Total</span>
              <span className="font-bold text-foreground">$0.00</span>
            </div>
          </div>

          <Button variant="luxury" className="w-full" size="lg">
            Request Detailed Quote
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EndUserPlatform;
