import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Blinds } from 'lucide-react';
import FileUploadField from '@/components/admin/FileUploadField';

interface CurtainModel {
  id: string;
  name: string;
  type: string;
  model_url: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CURTAIN_TYPES = [
  { value: 'panel', label: 'Panel' },
  { value: 'sheer', label: 'Sheer' },
  { value: 'roman', label: 'Roman' },
  { value: 'roller', label: 'Roller' },
  { value: 'pleated', label: 'Pleated' },
];

const CurtainModelManagement = () => {
  const [models, setModels] = useState<CurtainModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<CurtainModel | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('panel');
  const [formModelUrl, setFormModelUrl] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    let query = supabase.from('curtain_models').select('*').order('sort_order');
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load curtain models');
    } else {
      setModels(data as CurtainModel[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, [typeFilter]);

  const openCreate = () => {
    setEditingModel(null);
    setFormName('');
    setFormType('panel');
    setFormModelUrl('');
    setFormThumbnailUrl('');
    setFormIsActive(true);
    setFormSortOrder(0);
    setDialogOpen(true);
  };

  const openEdit = (model: CurtainModel) => {
    setEditingModel(model);
    setFormName(model.name);
    setFormType(model.type);
    setFormModelUrl(model.model_url);
    setFormThumbnailUrl(model.thumbnail_url || '');
    setFormIsActive(model.is_active);
    setFormSortOrder(model.sort_order);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formModelUrl.trim()) {
      toast.error('Name and model file are required');
      return;
    }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      type: formType,
      model_url: formModelUrl,
      thumbnail_url: formThumbnailUrl || null,
      is_active: formIsActive,
      sort_order: formSortOrder,
    };

    if (editingModel) {
      const { error } = await supabase.from('curtain_models').update(payload).eq('id', editingModel.id);
      if (error) { toast.error('Update failed'); setSaving(false); return; }
      await supabase.from('admin_activity_log').insert({
        action: 'update', entity_type: 'curtain_model', entity_id: editingModel.id, entity_name: formName,
      });
      toast.success('Curtain model updated');
    } else {
      const { error } = await supabase.from('curtain_models').insert(payload);
      if (error) { toast.error('Create failed'); setSaving(false); return; }
      await supabase.from('admin_activity_log').insert({
        action: 'create', entity_type: 'curtain_model', entity_name: formName,
      });
      toast.success('Curtain model created');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchModels();
  };

  const handleDelete = async (model: CurtainModel) => {
    if (!confirm(`Delete "${model.name}"?`)) return;
    const { error } = await supabase.from('curtain_models').delete().eq('id', model.id);
    if (error) { toast.error('Delete failed'); return; }
    await supabase.from('admin_activity_log').insert({
      action: 'delete', entity_type: 'curtain_model', entity_id: model.id, entity_name: model.name,
    });
    toast.success('Deleted');
    fetchModels();
  };

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display uppercase tracking-widest text-primary">Curtain Models</h2>
          <p className="text-xs text-muted-foreground mt-1">Upload and manage GLB models for curtains</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Model
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." className="pl-9 h-9 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CURTAIN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Blinds className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No curtain models found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Thumbnail</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  {m.thumbnail_url ? (
                    <img src={m.thumbnail_url} alt={m.name} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Blinds className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs font-medium">{m.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{m.type}</Badge></TableCell>
                <TableCell>
                  <Badge variant={m.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {m.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-sm">
              {editingModel ? 'Edit Curtain Model' : 'Add Curtain Model'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Curtain Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURTAIN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FileUploadField
              value={formModelUrl}
              onChange={setFormModelUrl}
              bucket="models"
              folder="curtains"
              accept=".glb,.gltf"
              label="3D Model (GLB)"
              description="Upload a .glb or .gltf curtain model"
            />
            <FileUploadField
              value={formThumbnailUrl}
              onChange={setFormThumbnailUrl}
              bucket="models"
              folder="curtains/thumbnails"
              accept="image/*"
              label="Thumbnail (optional)"
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Active</Label>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sort Order</Label>
              <Input type="number" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value))} className="h-8 text-xs w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CurtainModelManagement;
