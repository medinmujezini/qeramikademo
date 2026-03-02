import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AnimatedTabsList, AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
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
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';

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
      <div className="h-screen flex flex-col bg-background relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="gradient-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>

        {/* Header */}
        <header className="header-tech px-4 py-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackToHome />
              <div className="divider-tech" />
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Design Studio</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ShoppingCart className="h-4 w-4" />
                Cart
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
          {/* Animated Glassmorphic Tab Navigation */}
          <div className="flex justify-center py-3">
            <AnimatedTabsList value={activeTab}>
              <AnimatedTabsTrigger value="floor-plan">
                <PenTool className="h-3.5 w-3.5" />
                Room Layout
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="tiles">
                <Grid2X2 className="h-3.5 w-3.5" />
                Finishes
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="design">
                <Palette className="h-3.5 w-3.5" />
                3D View
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="quote">
                <ShoppingCart className="h-3.5 w-3.5" />
                Quote
              </AnimatedTabsTrigger>
            </AnimatedTabsList>
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

// Simplified Quote Tab for End Users
const QuoteTab = () => {
  return (
    <div className="h-full flex items-center justify-center p-8 relative">
      <GlassCard className="max-w-2xl w-full" variant="premium" showOrbs>
        <GlassCardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-primary" />
          </div>
          <GlassCardTitle className="text-2xl">Your Project Quote</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            <p className="mb-4">
              Complete your room design to generate an instant quote with materials and pricing.
            </p>
            <p className="text-sm">
              Add tiles to walls and place furniture in the Design tab to see your quote here.
            </p>
          </div>
          
          <div className="border-t border-border pt-6">
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Estimated Total</span>
              <span className="font-bold text-foreground">$0.00</span>
            </div>
          </div>

          <Button className="w-full btn-glow" size="lg">
            Request Detailed Quote
          </Button>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
};

export default EndUserPlatform;
