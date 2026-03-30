import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Image, FileImage, Loader2, Check, X, Eye, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useMaterialContext, PBRMaterial } from '@/contexts/MaterialContext';

interface TextureUploadProps {
  label: string;
  description?: string;
  previewUrl?: string;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
}

const TextureUpload = ({ label, description, previewUrl, onFileSelected, onRemove }: TextureUploadProps) => {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    onFileSelected(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-20 object-cover rounded-md border border-border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-md p-3 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <label className="cursor-pointer block">
            <FileImage className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Drop or click</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}
    </div>
  );
};

// Store raw File objects alongside preview blob URLs
interface PendingTextures {
  albedo?: { file: File; preview: string };
  normal?: { file: File; preview: string };
  roughness?: { file: File; preview: string };
  metallic?: { file: File; preview: string };
  ao?: { file: File; preview: string };
  arm?: { file: File; preview: string };
  height?: { file: File; preview: string };
}

type TextureSlot = keyof PendingTextures;

const PBRMaterialPanel = () => {
  const navigate = useNavigate();
  const { materials, loading, addMaterialFromFiles, removeMaterial, previewMaterialId, setPreviewMaterialId, refreshMaterials } = useMaterialContext();
  const [materialName, setMaterialName] = useState('');
  const [pendingTextures, setPendingTextures] = useState<PendingTextures>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workflowTab, setWorkflowTab] = useState<'separate' | 'arm'>('separate');
  const [saving, setSaving] = useState(false);

  const handleFileSelected = useCallback((slot: TextureSlot, file: File) => {
    const preview = URL.createObjectURL(file);
    setPendingTextures(prev => ({ ...prev, [slot]: { file, preview } }));
  }, []);

  const handleRemoveTexture = useCallback((slot: TextureSlot) => {
    setPendingTextures(prev => {
      const entry = prev[slot];
      if (entry) URL.revokeObjectURL(entry.preview);
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    Object.values(pendingTextures).forEach(entry => {
      if (entry) URL.revokeObjectURL(entry.preview);
    });
    setMaterialName('');
    setPendingTextures({});
  }, [pendingTextures]);

  const handleCreateMaterial = useCallback(async () => {
    if (!materialName.trim()) {
      toast.error('Please enter a material name');
      return;
    }

    setSaving(true);
    try {
      await addMaterialFromFiles({
        name: materialName.trim(),
        albedo: pendingTextures.albedo?.file,
        normal: pendingTextures.normal?.file,
        roughness: pendingTextures.roughness?.file,
        metallic: pendingTextures.metallic?.file,
        ao: pendingTextures.ao?.file,
        arm: pendingTextures.arm?.file,
        height: pendingTextures.height?.file,
      });
      resetForm();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [materialName, pendingTextures, addMaterialFromFiles, resetForm]);

  const handleDeleteMaterial = useCallback(async (id: string) => {
    await removeMaterial(id);
  }, [removeMaterial]);

  const handlePreviewMaterial = useCallback((id: string) => {
    setPreviewMaterialId(id);
    toast.success('Material set for preview');
    navigate('/raytracing');
  }, [setPreviewMaterialId, navigate]);

  const getTextureCount = (material: PBRMaterial) => {
    return [
      material.albedo,
      material.normal,
      material.roughness,
      material.metallic,
      material.ao,
      material.arm,
      material.height,
    ].filter(Boolean).length;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">PBR Materials</CardTitle>
            <CardDescription>Upload textures for physically based rendering</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshMaterials} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Material
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>Create PBR Material</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Material Name</Label>
                    <Input
                      value={materialName}
                      onChange={(e) => setMaterialName(e.target.value)}
                      placeholder="e.g., Marble, Wood, Concrete"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextureUpload
                      label="Albedo (Base Color)"
                      description="RGB color texture"
                      previewUrl={pendingTextures.albedo?.preview}
                      onFileSelected={(f) => handleFileSelected('albedo', f)}
                      onRemove={() => handleRemoveTexture('albedo')}
                    />
                    <TextureUpload
                      label="Normal Map"
                      description="Surface detail normals"
                      previewUrl={pendingTextures.normal?.preview}
                      onFileSelected={(f) => handleFileSelected('normal', f)}
                      onRemove={() => handleRemoveTexture('normal')}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Material Properties
                    </Label>
                    <Tabs value={workflowTab} onValueChange={(v) => setWorkflowTab(v as 'separate' | 'arm')}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="separate">Separate Maps</TabsTrigger>
                        <TabsTrigger value="arm">ARM Packed</TabsTrigger>
                      </TabsList>
                      <TabsContent value="separate" className="pt-3">
                        <div className="grid grid-cols-3 gap-3">
                          <TextureUpload
                            label="Roughness"
                            description="Grayscale"
                            previewUrl={pendingTextures.roughness?.preview}
                            onFileSelected={(f) => handleFileSelected('roughness', f)}
                            onRemove={() => handleRemoveTexture('roughness')}
                          />
                          <TextureUpload
                            label="Metallic"
                            description="Grayscale"
                            previewUrl={pendingTextures.metallic?.preview}
                            onFileSelected={(f) => handleFileSelected('metallic', f)}
                            onRemove={() => handleRemoveTexture('metallic')}
                          />
                          <TextureUpload
                            label="AO"
                            description="Ambient Occlusion"
                            previewUrl={pendingTextures.ao?.preview}
                            onFileSelected={(f) => handleFileSelected('ao', f)}
                            onRemove={() => handleRemoveTexture('ao')}
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="arm" className="pt-3">
                        <TextureUpload
                          label="ARM Texture"
                          description="R=AO, G=Roughness, B=Metallic (packed)"
                          previewUrl={pendingTextures.arm?.preview}
                          onFileSelected={(f) => handleFileSelected('arm', f)}
                          onRemove={() => handleRemoveTexture('arm')}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          ARM packs AO, Roughness, and Metallic into a single RGB texture for efficiency.
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <TextureUpload
                    label="Height / Displacement"
                    description="For parallax or displacement mapping"
                    previewUrl={pendingTextures.height?.preview}
                    onFileSelected={(f) => handleFileSelected('height', f)}
                    onRemove={() => handleRemoveTexture('height')}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMaterial} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Create Material
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No materials yet</p>
            <p className="text-xs mt-1">Create your first PBR material</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                    previewMaterialId === material.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {material.albedo ? (
                      <img
                        src={material.albedo}
                        alt={material.name}
                        className="w-12 h-12 rounded object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <FileImage className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{material.name}</p>
                        {previewMaterialId === material.id && (
                          <Badge variant="secondary" className="text-xs">Preview</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getTextureCount(material)} texture{getTextureCount(material) !== 1 ? 's' : ''}
                        {material.arm && ' • ARM'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePreviewMaterial(material.id)}
                      title="Preview in Raytracing"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteMaterial(material.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default PBRMaterialPanel;
