import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save } from 'lucide-react';

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure default values and preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Units & Measurements */}
        <Card>
          <CardHeader>
            <CardTitle>Units & Measurements</CardTitle>
            <CardDescription>Default measurement units for the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Unit System</Label>
                <Select defaultValue="metric">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (cm, m)</SelectItem>
                    <SelectItem value="imperial">Imperial (in, ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Wall Height (cm)</Label>
                <Input type="number" defaultValue={280} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Wall Thickness (cm)</Label>
                <Input type="number" defaultValue={15} />
              </div>
              <div className="space-y-2">
                <Label>Grid Snap Size (cm)</Label>
                <Input type="number" defaultValue={5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rendering Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Rendering Defaults</CardTitle>
            <CardDescription>Default quality settings for 3D rendering</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Shadows by Default</Label>
                <p className="text-sm text-muted-foreground">Show shadows in 3D view</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Ambient Occlusion</Label>
                <p className="text-sm text-muted-foreground">Add depth with SSAO effect</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Anti-aliasing</Label>
                <p className="text-sm text-muted-foreground">Smooth edges with TAA</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Auto-save */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-save</CardTitle>
            <CardDescription>Configure automatic saving behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Auto-save</Label>
                <p className="text-sm text-muted-foreground">Automatically save projects</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Auto-save Interval (seconds)</Label>
              <Input type="number" defaultValue={30} min={10} max={300} className="w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Plumbing Defaults */}
        <Card>
          <CardHeader>
            <CardTitle>Plumbing Defaults</CardTitle>
            <CardDescription>Default values for MEP calculations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Default Pipe Diameter (cm)</Label>
                <Input type="number" defaultValue={5} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label>Default Drain Slope (%)</Label>
                <Input type="number" defaultValue={2} step={0.25} />
              </div>
              <div className="space-y-2">
                <Label>Default Vent Height (cm)</Label>
                <Input type="number" defaultValue={150} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plumbing Code</Label>
              <Select defaultValue="ipc">
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipc">International Plumbing Code (IPC)</SelectItem>
                  <SelectItem value="upc">Uniform Plumbing Code (UPC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
