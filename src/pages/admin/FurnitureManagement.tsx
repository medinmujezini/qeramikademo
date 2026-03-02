import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import FurnitureForm from '@/components/admin/FurnitureForm';

interface FurnitureTemplate {
  id: string;
  type: string;
  category: string;
  name: string;
  dimensions_json: { width: number; depth: number; height: number };
  default_color: string;
  icon: string;
  model_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'living', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'dining', label: 'Dining' },
  { value: 'office', label: 'Office' },
  { value: 'storage', label: 'Storage' },
];

const FurnitureManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [furniture, setFurniture] = useState<FurnitureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FurnitureTemplate | null>(null);

  // Check for action=new in URL
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setEditingItem(null);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchFurniture = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('furniture_templates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Parse dimensions_json if it's a string
      const parsed = (data || []).map(item => ({
        ...item,
        dimensions_json: typeof item.dimensions_json === 'string' 
          ? JSON.parse(item.dimensions_json) 
          : item.dimensions_json
      }));
      
      setFurniture(parsed);
    } catch (error) {
      console.error('Error fetching furniture:', error);
      toast.error('Failed to load furniture templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFurniture();
  }, [categoryFilter, showInactive]);

  const filteredFurniture = furniture.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (item: FurnitureTemplate) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this furniture template?')) return;

    try {
      const { error } = await supabase
        .from('furniture_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Furniture template deleted');
      fetchFurniture();
      
      // Log activity
      await supabase.from('admin_activity_log').insert({
        action: 'delete',
        entity_type: 'furniture',
        entity_id: id,
      });
    } catch (error) {
      console.error('Error deleting furniture:', error);
      toast.error('Failed to delete furniture template');
    }
  };

  const handleToggleActive = async (item: FurnitureTemplate) => {
    try {
      const { error } = await supabase
        .from('furniture_templates')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Furniture deactivated' : 'Furniture activated');
      fetchFurniture();
    } catch (error) {
      console.error('Error toggling furniture status:', error);
      toast.error('Failed to update furniture status');
    }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingItem(null);
    fetchFurniture();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Furniture Templates</h1>
          <p className="text-muted-foreground">Manage furniture items for the floor plan designer</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Furniture
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search furniture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
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
      ) : filteredFurniture.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No furniture templates found</p>
          <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Furniture
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFurniture.map((item) => (
            <Card key={item.id} className={`group relative ${!item.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                {/* Thumbnail or Color Preview */}
                <div 
                  className="aspect-square rounded-lg mb-3 flex items-center justify-center"
                  style={{ backgroundColor: item.default_color + '20' }}
                >
                  {item.thumbnail_url ? (
                    <img 
                      src={item.thumbnail_url} 
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded"
                      style={{ backgroundColor: item.default_color }}
                    />
                  )}
                </div>
                
                {/* Info */}
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.dimensions_json.width} × {item.dimensions_json.depth} × {item.dimensions_json.height} cm
                </p>

                {/* Status Badge */}
                {!item.is_active && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                    Inactive
                  </Badge>
                )}

                {/* Actions */}
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
          {filteredFurniture.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-center gap-4 p-4 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: item.default_color + '20' }}
              >
                <div 
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: item.default_color }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {item.category} • {item.dimensions_json.width} × {item.dimensions_json.depth} × {item.dimensions_json.height} cm
                </p>
              </div>
              {!item.is_active && (
                <Badge variant="secondary">Inactive</Badge>
              )}
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
              {editingItem ? 'Edit Furniture Template' : 'Create Furniture Template'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the furniture template details below.'
                : 'Add a new furniture item to the library.'
              }
            </DialogDescription>
          </DialogHeader>
          <FurnitureForm 
            initialData={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FurnitureManagement;
