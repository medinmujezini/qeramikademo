import { useState } from 'react';
import { Database, Upload, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FURNITURE_TEMPLATES } from '@/data/furnitureLibrary';
import { FIXTURE_TEMPLATES } from '@/data/fixtureLibrary';

interface SeedResult {
  entity: string;
  success: number;
  failed: number;
  skipped: number;
}

const DataSeedPage = () => {
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SeedResult[]>([]);
  const [currentTask, setCurrentTask] = useState('');

  const seedFurniture = async (): Promise<SeedResult> => {
    let success = 0, failed = 0, skipped = 0;

    for (let i = 0; i < FURNITURE_TEMPLATES.length; i++) {
      const template = FURNITURE_TEMPLATES[i];
      setProgress(((i + 1) / FURNITURE_TEMPLATES.length) * 100);
      
      // Check if exists
      const { data: existing } = await supabase
        .from('furniture_templates')
        .select('id')
        .eq('type', template.type)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('furniture_templates').insert({
        type: template.type,
        category: template.category,
        name: template.name,
        dimensions_json: {
          width: template.dimensions.width,
          depth: template.dimensions.depth,
          height: template.dimensions.height,
        },
        default_color: template.color,
        icon: template.icon || 'box',
        is_active: true,
        sort_order: i,
      });

      if (error) {
        console.error('Furniture seed error:', error);
        failed++;
      } else {
        success++;
      }
    }

    return { entity: 'Furniture', success, failed, skipped };
  };

  const seedFixtures = async (): Promise<SeedResult> => {
    let success = 0, failed = 0, skipped = 0;

    for (let i = 0; i < FIXTURE_TEMPLATES.length; i++) {
      const template = FIXTURE_TEMPLATES[i];
      setProgress(((i + 1) / FIXTURE_TEMPLATES.length) * 100);
      
      // Check if exists
      const { data: existing } = await supabase
        .from('fixture_templates')
        .select('id')
        .eq('type', template.type)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('fixture_templates').insert({
        type: template.type,
        category: template.category,
        name: template.name,
        dimensions_json: {
          width: template.dimensions.width,
          depth: template.dimensions.depth,
          height: template.dimensions.height,
        },
        clearance_json: template.clearance,
        requires_wall: template.requiresWall,
        wall_offset: template.wallOffset,
        trap_height: template.trapHeight,
        supply_height: template.supplyHeight,
        wattage: template.wattage || null,
        connection_templates_json: template.connectionTemplates,
        dfu_value: template.type === 'toilet' ? 4 : template.type === 'sink' ? 1 : 2,
        gpm_cold: template.connectionTemplates.some(c => c.systemType === 'cold-water') ? 2.0 : 0,
        gpm_hot: template.connectionTemplates.some(c => c.systemType === 'hot-water') ? 2.0 : 0,
        icon: template.icon || 'droplet',
        is_active: true,
        sort_order: i,
      });

      if (error) {
        console.error('Fixture seed error:', error);
        failed++;
      } else {
        success++;
      }
    }

    return { entity: 'Fixtures', success, failed, skipped };
  };

  const seedColumns = async (): Promise<SeedResult> => {
    let success = 0, failed = 0, skipped = 0;

    const columnPresets = [
      { name: 'Standard Rectangle', shape: 'rectangle', width: 30, depth: 30, height: 280, structural: true },
      { name: 'Large Rectangle', shape: 'rectangle', width: 45, depth: 30, height: 280, structural: true },
      { name: 'Square Column', shape: 'square', width: 40, depth: 40, height: 280, structural: true },
      { name: 'Round Column', shape: 'round', width: 30, depth: 30, height: 280, structural: true },
      { name: 'Large Round', shape: 'round', width: 50, depth: 50, height: 280, structural: true },
      { name: 'L-Shaped Corner', shape: 'l-shaped', width: 45, depth: 45, height: 280, structural: true },
      { name: 'Decorative Round', shape: 'round', width: 25, depth: 25, height: 240, structural: false },
    ];

    for (let i = 0; i < columnPresets.length; i++) {
      const preset = columnPresets[i];
      setProgress(((i + 1) / columnPresets.length) * 100);

      const { data: existing } = await supabase
        .from('column_templates')
        .select('id')
        .eq('name', preset.name)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('column_templates').insert({
        name: preset.name,
        shape: preset.shape,
        default_dimensions_json: {
          width: preset.width,
          depth: preset.depth,
          height: preset.height,
        },
        is_structural: preset.structural,
        default_material: 'concrete',
        is_active: true,
        sort_order: i,
      });

      if (error) {
        console.error('Column seed error:', error);
        failed++;
      } else {
        success++;
      }
    }

    return { entity: 'Columns', success, failed, skipped };
  };

  const seedTiles = async (): Promise<SeedResult> => {
    let success = 0, failed = 0, skipped = 0;

    const tilePresets = [
      { name: 'White Subway', material: 'ceramic', width: 7.5, height: 15, color: '#FFFFFF', price: 0.50 },
      { name: 'Black Subway', material: 'ceramic', width: 7.5, height: 15, color: '#1A1A1A', price: 0.55 },
      { name: 'Metro Gray', material: 'ceramic', width: 10, height: 20, color: '#808080', price: 0.60 },
      { name: 'Marble White', material: 'marble', width: 30, height: 30, color: '#F5F5F5', price: 8.00 },
      { name: 'Marble Black', material: 'marble', width: 30, height: 30, color: '#2D2D2D', price: 9.00 },
      { name: 'Porcelain Large', material: 'porcelain', width: 60, height: 60, color: '#E8E8E8', price: 4.50 },
      { name: 'Porcelain Beige', material: 'porcelain', width: 60, height: 60, color: '#D4C4B0', price: 4.75 },
      { name: 'Mosaic Blue', material: 'mosaic', width: 2.5, height: 2.5, color: '#4A90D9', price: 12.00, flexible: true },
      { name: 'Mosaic Green', material: 'mosaic', width: 2.5, height: 2.5, color: '#4CAF50', price: 12.00, flexible: true },
      { name: 'Glass Clear', material: 'glass', width: 10, height: 10, color: '#C0E8FF', price: 15.00 },
      { name: 'Slate Natural', material: 'slate', width: 30, height: 60, color: '#4A5568', price: 6.00 },
      { name: 'Terracotta', material: 'ceramic', width: 20, height: 20, color: '#CD5C5C', price: 2.00 },
    ];

    for (let i = 0; i < tilePresets.length; i++) {
      const preset = tilePresets[i];
      setProgress(((i + 1) / tilePresets.length) * 100);

      const { data: existing } = await supabase
        .from('tile_templates')
        .select('id')
        .eq('name', preset.name)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('tile_templates').insert({
        name: preset.name,
        material: preset.material,
        dimensions_json: {
          width: preset.width,
          height: preset.height,
        },
        default_color: preset.color,
        price_per_unit: preset.price,
        is_flexible: (preset as any).flexible || false,
        min_curve_radius: (preset as any).flexible ? 10 : null,
        is_active: true,
        sort_order: i,
      });

      if (error) {
        console.error('Tile seed error:', error);
        failed++;
      } else {
        success++;
      }
    }

    return { entity: 'Tiles', success, failed, skipped };
  };

  const runSeedAll = async () => {
    setSeeding(true);
    setResults([]);
    setProgress(0);

    try {
      setCurrentTask('Seeding furniture templates...');
      const furnitureResult = await seedFurniture();
      setResults(prev => [...prev, furnitureResult]);

      setCurrentTask('Seeding fixture templates...');
      const fixtureResult = await seedFixtures();
      setResults(prev => [...prev, fixtureResult]);

      setCurrentTask('Seeding column templates...');
      const columnResult = await seedColumns();
      setResults(prev => [...prev, columnResult]);

      setCurrentTask('Seeding tile templates...');
      const tileResult = await seedTiles();
      setResults(prev => [...prev, tileResult]);

      setCurrentTask('Complete!');
      toast.success('Database seeded successfully');
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Failed to seed database');
    } finally {
      setSeeding(false);
    }
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL template data? This cannot be undone.')) return;

    setSeeding(true);
    setCurrentTask('Clearing data...');

    try {
      await supabase.from('furniture_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('fixture_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('column_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tile_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      toast.success('All template data cleared');
      setResults([]);
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to clear data');
    } finally {
      setSeeding(false);
      setCurrentTask('');
    }
  };

  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Data Seeding</h1>
        <p className="text-muted-foreground">
          Populate the database with initial templates from TypeScript constants
        </p>
      </div>

      {/* Source Data Info */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Furniture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{FURNITURE_TEMPLATES.length}</div>
            <p className="text-xs text-muted-foreground">templates available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fixtures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{FIXTURE_TEMPLATES.length}</div>
            <p className="text-xs text-muted-foreground">templates available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground">presets ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">presets ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Seed Operations
          </CardTitle>
          <CardDescription>
            Import template data from the codebase into the database. Existing entries will be skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={runSeedAll} disabled={seeding}>
              {seeding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Seed All Data
            </Button>
            <Button variant="destructive" onClick={clearAllData} disabled={seeding}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
          </div>

          {seeding && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{currentTask}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{result.entity}</span>
                  <div className="flex gap-3">
                    {result.success > 0 && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {result.success} added
                      </Badge>
                    )}
                    {result.skipped > 0 && (
                      <Badge variant="secondary">
                        {result.skipped} skipped
                      </Badge>
                    )}
                    {result.failed > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {result.failed} failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              
              <Separator className="my-3" />
              
              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <div className="flex gap-3">
                  <Badge variant="default">{totalSuccess} added</Badge>
                  <Badge variant="secondary">{totalSkipped} skipped</Badge>
                  {totalFailed > 0 && <Badge variant="destructive">{totalFailed} failed</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataSeedPage;
