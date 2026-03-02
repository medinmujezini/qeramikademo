import { useEffect, useState } from 'react';
import { Plus, Search, Grid, List, MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ColumnForm from '@/components/admin/ColumnForm';

interface ColumnTemplate {
  id: string;
  name: string;
  shape: string;
  default_dimensions_json: { width: number; depth: number; height: number };
  is_structural: boolean;
  default_material: string;
  is_active: boolean;
  sort_order: number;
}

const shapes = [
  { value: 'all', label: 'All Shapes' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
  { value: 'l-shaped', label: 'L-Shaped' },
  { value: 't-shaped', label: 'T-Shaped' },
];

const ColumnManagement = () => {
  const [columns, setColumns] = useState<ColumnTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [shapeFilter, setShapeFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ColumnTemplate | null>(null);

  const fetchColumns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('column_templates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (shapeFilter !== 'all') {
        query = query.eq('shape', shapeFilter);
      }

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const parsed = (data || []).map(item => ({
        ...item,
        default_dimensions_json: typeof item.default_dimensions_json === 'string' 
          ? JSON.parse(item.default_dimensions_json) 
          : item.default_dimensions_json,
      }));
      
      setColumns(parsed);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast.error('Failed to load column templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColumns();
  }, [shapeFilter, showInactive]);

  const filteredColumns = columns.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (item: ColumnTemplate) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this column template?')) return;

    try {
      const { error } = await supabase
        .from('column_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Column template deleted');
      fetchColumns();
    } catch (error) {
      console.error('Error deleting column:', error);
      toast.error('Failed to delete column template');
    }
  };

  const handleToggleActive = async (item: ColumnTemplate) => {
    try {
      const { error } = await supabase
        .from('column_templates')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Column deactivated' : 'Column activated');
      fetchColumns();
    } catch (error) {
      console.error('Error toggling column status:', error);
      toast.error('Failed to update column status');
    }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingItem(null);
    fetchColumns();
  };

  const getShapeIcon = (shape: string) => {
    switch (shape) {
      case 'round': return '●';
      case 'square': return '■';
      case 'l-shaped': return '⌐';
      case 't-shaped': return '┬';
      default: return '▬';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Column Templates</h1>
          <p className="text-muted-foreground">Manage structural and decorative columns</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Column
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={shapeFilter} onValueChange={setShapeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shapes.map((shape) => (
              <SelectItem key={shape.value} value={shape.value}>
                {shape.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showInactive ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? 'Hide Inactive' : 'Show Inactive'}
        </Button>
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredColumns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No column templates found</p>
          <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Column
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredColumns.map((item) => (
            <Card key={item.id} className={`group relative ${!item.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="aspect-square rounded-lg mb-3 flex items-center justify-center bg-muted">
                  <span className="text-4xl text-muted-foreground">
                    {getShapeIcon(item.shape)}
                  </span>
                </div>
                
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{item.shape}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.default_dimensions_json.width} × {item.default_dimensions_json.depth} cm
                </p>

                <div className="flex gap-1 mt-2">
                  {item.is_structural && (
                    <Badge variant="default" className="text-xs">Structural</Badge>
                  )}
                  {!item.is_active && (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                      {item.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filteredColumns.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-center gap-4 p-4 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                <span className="text-2xl text-muted-foreground">
                  {getShapeIcon(item.shape)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {item.shape} • {item.default_dimensions_json.width} × {item.default_dimensions_json.depth} × {item.default_dimensions_json.height} cm
                </p>
              </div>
              <div className="flex gap-2">
                {item.is_structural && (
                  <Badge variant="default">Structural</Badge>
                )}
                {!item.is_active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(item)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                    {item.is_active ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(item.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Column Template' : 'Create Column Template'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the column template details.'
                : 'Add a new column type to the library.'
              }
            </DialogDescription>
          </DialogHeader>
          <ColumnForm 
            initialData={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ColumnManagement;
