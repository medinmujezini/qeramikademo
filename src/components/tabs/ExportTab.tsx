import React from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { FileDown, FileText, Image } from 'lucide-react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';

export const ExportTab: React.FC = () => {
  const { floorPlan } = useFloorPlanContext();

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(floorPlan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${floorPlan.name}.json`;
    a.click();
  };

  return (
    <div className="h-full relative p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-sm">Export Options</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-2">
            <Button className="w-full justify-start" onClick={exportJSON}>
              <FileDown className="h-4 w-4 mr-2" />Export Project (JSON)
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="h-4 w-4 mr-2" />Export Floor Plan (PDF)
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <Image className="h-4 w-4 mr-2" />Export as Image (PNG)
            </Button>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-sm">Material Reports</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="h-4 w-4 mr-2" />Material Shopping List
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="h-4 w-4 mr-2" />Tile Cut Sheet
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="h-4 w-4 mr-2" />Plumbing Diagram
            </Button>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
};
