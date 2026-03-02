/**
 * Import/Export Page
 * 
 * Bulk import/export functionality for all admin templates.
 * Supports JSON format for backup and migration.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Download, Upload, FileJson, Loader2, 
  CheckCircle, AlertCircle, Package, Bath,
  Columns, Palette, Square
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExportData {
  version: string;
  exportedAt: string;
  furniture_templates?: any[];
  fixture_templates?: any[];
  tile_templates?: any[];
  column_templates?: any[];
  grout_colors?: any[];
}

const EXPORT_OPTIONS = [
  { key: 'furniture_templates', label: 'Furniture Templates', icon: Package },
  { key: 'fixture_templates', label: 'Fixture Templates', icon: Bath },
  { key: 'tile_templates', label: 'Tile Templates', icon: Square },
  { key: 'column_templates', label: 'Column Templates', icon: Columns },
  { key: 'grout_colors', label: 'Grout Colors', icon: Palette },
] as const;

type ExportKey = typeof EXPORT_OPTIONS[number]['key'];

export default function ImportExportPage() {
  const [selectedExports, setSelectedExports] = useState<Set<ExportKey>>(new Set(['furniture_templates', 'fixture_templates']));
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importData, setImportData] = useState('');
  const [importPreview, setImportPreview] = useState<ExportData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch counts for each template type
  const { data: counts } = useQuery({
    queryKey: ['template-counts'],
    queryFn: async () => {
      const [furniture, fixtures, tiles, columns, grout] = await Promise.all([
        supabase.from('furniture_templates').select('id', { count: 'exact', head: true }),
        supabase.from('fixture_templates').select('id', { count: 'exact', head: true }),
        supabase.from('tile_templates').select('id', { count: 'exact', head: true }),
        supabase.from('column_templates').select('id', { count: 'exact', head: true }),
        supabase.from('grout_colors').select('id', { count: 'exact', head: true }),
      ]);
      return {
        furniture_templates: furniture.count || 0,
        fixture_templates: fixtures.count || 0,
        tile_templates: tiles.count || 0,
        column_templates: columns.count || 0,
        grout_colors: grout.count || 0,
      };
    },
  });

  const toggleExport = (key: ExportKey) => {
    const newSet = new Set(selectedExports);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedExports(newSet);
  };

  const handleExport = async () => {
    if (selectedExports.size === 0) {
      toast.error('Please select at least one category to export');
      return;
    }

    setIsExporting(true);
    try {
      const exportData: ExportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
      };

      for (const key of selectedExports) {
        const { data, error } = await supabase.from(key).select('*');
        if (error) throw error;
        exportData[key] = data;
      }

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `templates-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export completed successfully');
    } catch (error: any) {
      toast.error('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportPaste = (value: string) => {
    setImportData(value);
    setImportError(null);
    setImportPreview(null);

    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);
      if (!parsed.version) {
        setImportError('Invalid export format: missing version');
        return;
      }
      setImportPreview(parsed);
    } catch (e) {
      setImportError('Invalid JSON format');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleImportPaste(content);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview) {
      toast.error('No valid data to import');
      return;
    }

    setIsImporting(true);
    try {
      const results: { key: string; count: number }[] = [];

      for (const option of EXPORT_OPTIONS) {
        const data = importPreview[option.key];
        if (data && data.length > 0) {
          // Remove id fields to let DB generate new ones, or use upsert
          const cleanData = data.map((item: any) => {
            const { id, created_at, updated_at, ...rest } = item;
            return rest;
          });

          const { error } = await supabase.from(option.key).upsert(cleanData, {
            onConflict: option.key === 'grout_colors' ? 'name' : 'type',
            ignoreDuplicates: false,
          });

          if (error) {
            console.warn(`Error importing ${option.key}:`, error);
            // Try insert instead
            const { error: insertError } = await supabase.from(option.key).insert(cleanData);
            if (insertError) {
              throw new Error(`Failed to import ${option.label}: ${insertError.message}`);
            }
          }

          results.push({ key: option.label, count: data.length });
        }
      }

      if (results.length === 0) {
        toast.warning('No data found to import');
      } else {
        const summary = results.map(r => `${r.count} ${r.key}`).join(', ');
        toast.success(`Imported: ${summary}`);
        setImportData('');
        setImportPreview(null);
      }
    } catch (error: any) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground">Backup and restore template data</p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Export Templates
              </CardTitle>
              <CardDescription>
                Select categories to export as JSON for backup or migration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {EXPORT_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={key}
                        checked={selectedExports.has(key)}
                        onCheckedChange={() => toggleExport(key)}
                      />
                      <Label htmlFor={key} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {label}
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {counts?.[key] ?? '...'} items
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => setSelectedExports(new Set(EXPORT_OPTIONS.map(o => o.key)))}
                  variant="outline"
                  size="sm"
                >
                  Select All
                </Button>
                <Button
                  onClick={() => setSelectedExports(new Set())}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting || selectedExports.size === 0}
                className="w-full"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected ({selectedExports.size})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Templates
              </CardTitle>
              <CardDescription>
                Upload a JSON export file or paste the content below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="import-file"
                />
                <Label
                  htmlFor="import-file"
                  className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Click to upload JSON file</span>
                </Label>
              </div>

              <div className="text-center text-sm text-muted-foreground">or paste JSON below</div>

              <Textarea
                placeholder='{"version": "1.0", ...}'
                value={importData}
                onChange={(e) => handleImportPaste(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
              />

              {/* Error */}
              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {importPreview && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Valid export file (v{importPreview.version})</p>
                      <p className="text-sm text-muted-foreground">
                        Exported: {new Date(importPreview.exportedAt).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {EXPORT_OPTIONS.map(({ key, label }) => {
                          const count = importPreview[key]?.length;
                          if (!count) return null;
                          return (
                            <span key={key} className="text-xs bg-muted px-2 py-1 rounded">
                              {count} {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleImport}
                disabled={isImporting || !importPreview}
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
