import React, { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AnimatedTabsList, AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthProvider } from '@/contexts/AuthContext';
import { FloorPlanTab } from '@/components/tabs/FloorPlanTab';
import { TilesTab } from '@/components/tabs/TilesTab';
import { DesignTab } from '@/components/tabs/DesignTab';
import { PlumbingTab } from '@/components/tabs/PlumbingTab';
import { EstimateWizard } from '@/components/tabs/EstimateWizard';
import { ProjectsTab } from '@/components/tabs/ProjectsTab';
import { ExportTab } from '@/components/tabs/ExportTab';
import { BackToHome } from '@/components/home/BackToHome';
import { 
  PenTool, 
  Droplets, 
  Grid2X2, 
  FileDown, 
  Cuboid, 
  Scan,
  Palette,
  DollarSign,
  FolderOpen,
  ChevronDown,
  Wrench,
} from 'lucide-react';
import type { WallTileSection } from '@/types/floorPlan';

const WorkerPlatform = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'floor-plan';
  
  const [activeTab, setActiveTab] = useState(initialTab);
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

        {/* Professional Header */}
        <header className="header-tech px-4 py-2.5 relative z-10">
          <div className="flex items-center justify-between">
            {/* Left section - Back button and branding */}
            <div className="flex items-center gap-4">
              <BackToHome />
              <div className="divider-tech" />
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">Worker Platform</span>
              </div>
            </div>
            
            {/* Right section - navigation */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <FolderOpen className="h-4 w-4" />
                    Projects
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/platform?tab=projects" className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      My Projects
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/platform?tab=export" className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Export
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="divider-tech" />
              
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
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
          {/* Animated Glassmorphic Tab Navigation */}
          <div className="flex justify-center py-3">
            <AnimatedTabsList value={activeTab}>
              <AnimatedTabsTrigger value="floor-plan">
                <PenTool className="h-3.5 w-3.5" />
                Floor Plan
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="tiles">
                <Grid2X2 className="h-3.5 w-3.5" />
                Tiles
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="design">
                <Palette className="h-3.5 w-3.5" />
                Design
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="plumbing">
                <Droplets className="h-3.5 w-3.5" />
                Plumbing
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="estimate">
                <DollarSign className="h-3.5 w-3.5" />
                Estimate
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
          <TabsContent value="plumbing" className="flex-1 m-0">
            <PlumbingTab />
          </TabsContent>
          <TabsContent value="estimate" className="flex-1 m-0">
            <EstimateWizard />
          </TabsContent>
          
          <TabsContent value="projects" className="flex-1 m-0">
            <ProjectsTab />
          </TabsContent>
          <TabsContent value="export" className="flex-1 m-0">
            <ExportTab />
          </TabsContent>
        </Tabs>
      </div>
    </AuthProvider>
  );
};

export default WorkerPlatform;
