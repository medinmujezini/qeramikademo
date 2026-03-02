import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Box, DoorOpen, LayoutGrid, Zap } from 'lucide-react';

interface BlueprintSettingsStepProps {
  defaultWallThickness: number;
  detectDoors: boolean;
  detectWindows: boolean;
  highAccuracy?: boolean;
  onComplete: (settings: { wallThickness: number; detectDoors: boolean; detectWindows: boolean; highAccuracy: boolean }) => void;
  onBack: () => void;
}

export const BlueprintSettingsStep: React.FC<BlueprintSettingsStepProps> = ({
  defaultWallThickness,
  detectDoors,
  detectWindows,
  highAccuracy: defaultHighAccuracy = false,
  onComplete,
  onBack,
}) => {
  const [wallThickness, setWallThickness] = useState(defaultWallThickness);
  const [detectDoorsEnabled, setDetectDoorsEnabled] = useState(detectDoors);
  const [detectWindowsEnabled, setDetectWindowsEnabled] = useState(detectWindows);
  const [highAccuracyEnabled, setHighAccuracyEnabled] = useState(defaultHighAccuracy);

  const handleSubmit = () => {
    onComplete({
      wallThickness,
      detectDoors: detectDoorsEnabled,
      detectWindows: detectWindowsEnabled,
      highAccuracy: highAccuracyEnabled,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Wall Settings
              </CardTitle>
              <CardDescription>
                Configure default wall properties for the detected floor plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="thickness">Default Wall Thickness (cm)</Label>
                <Input
                  id="thickness"
                  type="number"
                  value={wallThickness}
                  onChange={(e) => setWallThickness(parseInt(e.target.value) || 15)}
                  className="w-24"
                  min={5}
                  max={50}
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Standard interior walls are typically 10-15cm. Exterior walls are usually 20-30cm.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5" />
                Detection Options
              </CardTitle>
              <CardDescription>
                Choose which elements to detect automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="detect-doors">Detect Doors</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically identify door openings and swing directions
                  </p>
                </div>
                <Switch
                  id="detect-doors"
                  checked={detectDoorsEnabled}
                  onCheckedChange={setDetectDoorsEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="detect-windows">Detect Windows</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically identify window placements on walls
                  </p>
                </div>
                <Switch
                  id="detect-windows"
                  checked={detectWindowsEnabled}
                  onCheckedChange={setDetectWindowsEnabled}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Analysis Quality
              </CardTitle>
              <CardDescription>
                Choose accuracy level for complex floor plans
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="high-accuracy">High Accuracy Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Takes longer but produces better results for complex plans
                  </p>
                </div>
                <Switch
                  id="high-accuracy"
                  checked={highAccuracyEnabled}
                  onCheckedChange={setHighAccuracyEnabled}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <LayoutGrid className="h-5 w-5" />
                AI-Powered Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The next step will use AI to analyze your floor plan image and extract:
              </p>
              <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                <li>• Wall positions and connections</li>
                <li>• Room boundaries and labels</li>
                {detectDoorsEnabled && <li>• Door locations and types</li>}
                {detectWindowsEnabled && <li>• Window positions</li>}
              </ul>
              {highAccuracyEnabled && (
                <p className="mt-3 text-xs text-primary font-medium">
                  ⚡ High Accuracy Mode enabled - analysis may take 60-90 seconds
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="p-4 border-t bg-background">
        <div className="flex justify-between max-w-lg mx-auto">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleSubmit}>
            Start Analysis
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
