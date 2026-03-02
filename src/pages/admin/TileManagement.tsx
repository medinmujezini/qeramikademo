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
import TileForm from '@/components/admin/TileForm';

interface TileTemplate {
  id: string;
  name: string;
  material: string;
  dimensions_json: { width: number; height: number };
  price_per_unit: number;
  default_color: string;
  min_curve_radius: number | null;
  is_flexible: boolean;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const materials = [
  { value: 'all', label: 'All Materials' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'glass', label: 'Glass' },
  { value: 'marble', label: 'Marble' },
  { value: 'granite', label: 'Granite' },
  { value: 'slate', label: 'Slate' },
  { value: 'mosaic', label: 'Mosaic' },
];

const TileManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tiles, setTiles] = useState<TileTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TileTemplate | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setEditingItem(null);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchTiles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tile_templates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (materialFilter !== 'all') {
        query = query.eq('material', materialFilter);
      }

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const parsed = (data || []).map(item => ({
        ...item,
        dimensions_json: typeof item.dimensions_json === 'string' 
          ? JSON.parse(item.dimensions_json) 
          : item.dimensions_json,
      }));
      
      setTiles(parsed);
    } catch (error) {
      console.error('Error fetching tiles:', error);
      toast.error('Failed to load tile templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiles();
  }, [materialFilter, showInactive]);

  const filteredTiles = tiles.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (item: TileTemplate) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tile template?')) return;

    try {
      const { error } = await supabase
        .from('tile_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tile template deleted');
      fetchTiles();
    } catch (error) {
      console.error('Error deleting tile:', error);
      toast.error('Failed to delete tile template');
    }
  };

  const handleToggleActive = async (item: TileTemplate) => {
    try {
      const { error } = await supabase
        .from('tile_templates')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Tile deactivated' : 'Tile activated');
      fetchTiles();
    } catch (error) {
      console.error('Error toggling tile status:', error);
      toast.error('Failed to update tile status');
    }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingItem(null);
    fetchTiles();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tile Templates</h1>
          <p className="text-muted-foreground">Manage tile patterns and materials</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Tile
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={materialFilter} onValueChange={setMaterialFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {materials.map((mat) => (
              <SelectItem key={mat.value} value={mat.value}>
                {mat.label}
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
      ) : filteredTiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No tile templates found</p>
          <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Tile
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTiles.map((item) => (
            <Card key={item.id} className={`group relative ${!item.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div 
                  className="aspect-square rounded-lg mb-3 border-2"
                  style={{ backgroundColor: item.default_color }}
                >
                  {item.thumbnail_url && (
                    <img 
                      src={item.thumbnail_url} 
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                </div>
                
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{item.material}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.dimensions_json.width} × {item.dimensions_json.height} cm
                </p>
                {item.price_per_unit > 0 && (
                  <p className="text-sm font-medium text-primary mt-1">
                    ${item.price_per_unit.toFixed(2)}/unit
                  </p>
                )}

                {item.is_flexible && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                    Flexible
                  </Badge>
                )}

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
          {filteredTiles.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-center gap-4 p-4 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div 
                className="w-12 h-12 rounded-lg border-2"
                style={{ backgroundColor: item.default_color }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {item.material} • {item.dimensions_json.width} × {item.dimensions_json.height} cm
                </p>
              </div>
              {item.price_per_unit > 0 && (
                <span className="font-medium text-primary">
                  ${item.price_per_unit.toFixed(2)}
                </span>
              )}
              {item.is_flexible && (
                <Badge variant="secondary">Flexible</Badge>
              )}
              {!item.is_active && (
                <Badge variant="outline">Inactive</Badge>
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
              {editingItem ? 'Edit Tile Template' : 'Create Tile Template'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the tile template details.'
                : 'Add a new tile pattern to the catalog.'
              }
            </DialogDescription>
          </DialogHeader>
          <TileForm 
            initialData={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TileManagement;
