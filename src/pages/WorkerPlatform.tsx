import React, { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm px-6 h-14 flex items-center justify-between relative z-10" style={{ borderBottomColor: 'hsl(var(--primary) / 0.12)' }}>
          <div className="flex items-center gap-3">
            <BackToHome />
            <div className="w-px h-5 bg-border/30" />
            <div className="flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm text-foreground tracking-wider">Worker Platform</span>
            </div>
          </div>
          
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
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10">
          {/* Tab Navigation */}
          <div className="border-b border-border bg-card/50 flex justify-center px-4">
            <TabsList className="h-10">
              <TabsTrigger value="floor-plan" className="gap-1.5">
                <PenTool className="h-3.5 w-3.5" />
                Floor Plan
              </TabsTrigger>
              <TabsTrigger value="tiles" className="gap-1.5">
                <Grid2X2 className="h-3.5 w-3.5" />
                Tiles
              </TabsTrigger>
              <TabsTrigger value="design" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Design
              </TabsTrigger>
              <TabsTrigger value="plumbing" className="gap-1.5">
                <Droplets className="h-3.5 w-3.5" />
                Plumbing
              </TabsTrigger>
              <TabsTrigger value="estimate" className="gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Estimate
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
