import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ColorPickerField from '@/components/admin/ColorPickerField';

interface GroutColor {
  id: string;
  name: string;
  hex_color: string;
  is_active: boolean;
  sort_order: number;
}

const GroutManagement = () => {
  const [grouts, setGrouts] = useState<GroutColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GroutColor | null>(null);
  const [formData, setFormData] = useState({ name: '', hex_color: '#808080', is_active: true });

  const fetchGrouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grout_colors')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setGrouts(data || []);
    } catch (error) {
      console.error('Error fetching grout colors:', error);
      toast.error('Failed to load grout colors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrouts();
  }, []);

  const handleEdit = (item: GroutColor) => {
    setEditingItem(item);
    setFormData({ name: item.name, hex_color: item.hex_color, is_active: item.is_active });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this grout color?')) return;

    try {
      const { error } = await supabase
        .from('grout_colors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Grout color deleted');
      fetchGrouts();
    } catch (error) {
      console.error('Error deleting grout:', error);
      toast.error('Failed to delete grout color');
    }
  };

  const handleToggleActive = async (item: GroutColor) => {
    try {
      const { error } = await supabase
        .from('grout_colors')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Grout deactivated' : 'Grout activated');
      fetchGrouts();
    } catch (error) {
      console.error('Error toggling grout status:', error);
      toast.error('Failed to update grout status');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('grout_colors')
          .update({
            name: formData.name,
            hex_color: formData.hex_color,
            is_active: formData.is_active,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Grout color updated');
      } else {
        const { error } = await supabase
          .from('grout_colors')
          .insert({
            name: formData.name,
            hex_color: formData.hex_color,
            is_active: formData.is_active,
            sort_order: grouts.length,
          });

        if (error) throw error;
        toast.success('Grout color created');
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ name: '', hex_color: '#808080', is_active: true });
      fetchGrouts();
    } catch (error) {
      console.error('Error saving grout:', error);
      toast.error('Failed to save grout color');
    }
  };

  const openNewDialog = () => {
    setEditingItem(null);
    setFormData({ name: '', hex_color: '#808080', is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grout Colors</h1>
          <p className="text-muted-foreground">Manage grout color presets for tiles</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Grout Color
        </Button>
      </div>

      {/* Color Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : grouts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No grout colors found</p>
          <Button onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Grout Color
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>
              {grouts.filter(g => g.is_active).length} active colors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {grouts.map((grout) => (
                <div 
                  key={grout.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    !grout.is_active ? 'opacity-50 bg-muted/30' : 'bg-card'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  
                  <div 
                    className="w-10 h-10 rounded-lg border-2 shadow-sm"
                    style={{ backgroundColor: grout.hex_color }}
                  />
                  
                  <div className="flex-1">
                    <p className="font-medium">{grout.name}</p>
                    <p className="text-sm text-muted-foreground font-mono uppercase">
                      {grout.hex_color}
                    </p>
                  </div>

                  {!grout.is_active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={grout.is_active} 
                      onCheckedChange={() => handleToggleActive(grout)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(grout)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(grout.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>See how grout colors look with tiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1 p-4 bg-muted rounded-lg">
            {grouts.filter(g => g.is_active).slice(0, 8).map((grout, i) => (
              <div key={grout.id} className="aspect-square">
                <div 
                  className="w-full h-full grid grid-cols-2 gap-[2px] p-[2px]"
                  style={{ backgroundColor: grout.hex_color }}
                >
                  {[...Array(4)].map((_, j) => (
                    <div 
                      key={j} 
                      className="bg-white dark:bg-zinc-200"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Grout Color' : 'Add Grout Color'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the grout color details.'
                : 'Add a new grout color to the palette.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Medium Gray"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPickerField 
                value={formData.hex_color}
                onChange={(color) => setFormData(prev => ({ ...prev, hex_color: color }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch 
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroutManagement;
