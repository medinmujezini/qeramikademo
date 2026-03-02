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
import FixtureForm from '@/components/admin/FixtureForm';

interface FixtureTemplate {
  id: string;
  type: string;
  category: string;
  name: string;
  dimensions_json: { width: number; depth: number; height: number };
  clearance_json: { front: number; sides: number; rear: number };
  requires_wall: boolean;
  wall_offset: number;
  trap_height: number | null;
  supply_height: number | null;
  wattage: number | null;
  connection_templates_json: any[];
  dfu_value: number;
  gpm_cold: number;
  gpm_hot: number;
  icon: string;
  model_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'utility', label: 'Utility' },
];

const FixtureManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fixtures, setFixtures] = useState<FixtureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixtureTemplate | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setDialogOpen(true);
      setEditingItem(null);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchFixtures = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fixture_templates')
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
      
      const parsed = (data || []).map(item => ({
        ...item,
        dimensions_json: typeof item.dimensions_json === 'string' 
          ? JSON.parse(item.dimensions_json) 
          : item.dimensions_json,
        clearance_json: typeof item.clearance_json === 'string'
          ? JSON.parse(item.clearance_json)
          : item.clearance_json,
        connection_templates_json: typeof item.connection_templates_json === 'string'
          ? JSON.parse(item.connection_templates_json)
          : item.connection_templates_json || [],
      }));
      
      setFixtures(parsed);
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      toast.error('Failed to load fixture templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixtures();
  }, [categoryFilter, showInactive]);

  const filteredFixtures = fixtures.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (item: FixtureTemplate) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fixture template?')) return;

    try {
      const { error } = await supabase
        .from('fixture_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Fixture template deleted');
      fetchFixtures();
    } catch (error) {
      console.error('Error deleting fixture:', error);
      toast.error('Failed to delete fixture template');
    }
  };

  const handleToggleActive = async (item: FixtureTemplate) => {
    try {
      const { error } = await supabase
        .from('fixture_templates')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      toast.success(item.is_active ? 'Fixture deactivated' : 'Fixture activated');
      fetchFixtures();
    } catch (error) {
      console.error('Error toggling fixture status:', error);
      toast.error('Failed to update fixture status');
    }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingItem(null);
    fetchFixtures();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fixture Templates (MEP)</h1>
          <p className="text-muted-foreground">Manage plumbing fixtures with connection points</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Fixture
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search fixtures..."
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
      ) : filteredFixtures.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No fixture templates found</p>
          <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Fixture
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFixtures.map((item) => (
            <Card key={item.id} className={`group relative ${!item.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div 
                  className="aspect-square rounded-lg mb-3 flex items-center justify-center bg-blue-500/10"
                >
                  {item.thumbnail_url ? (
                    <img 
                      src={item.thumbnail_url} 
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-blue-500 text-4xl">💧</div>
                  )}
                </div>
                
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {item.dfu_value} DFU
                  </Badge>
                  {item.wattage && (
                    <Badge variant="outline" className="text-xs">
                      {item.wattage}W
                    </Badge>
                  )}
                </div>

                {!item.is_active && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                    Inactive
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
          {filteredFixtures.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-center gap-4 p-4 ${!item.is_active ? 'opacity-60' : ''}`}
            >
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-500/10">
                <span className="text-2xl">💧</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {item.category} • {item.dfu_value} DFU • {item.gpm_cold + item.gpm_hot} GPM
                </p>
              </div>
              <div className="flex gap-2">
                {item.requires_wall && (
                  <Badge variant="outline">Wall Mount</Badge>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Fixture Template' : 'Create Fixture Template'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Update the fixture template details and plumbing specifications.'
                : 'Add a new MEP fixture with connection points.'
              }
            </DialogDescription>
          </DialogHeader>
          <FixtureForm 
            initialData={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixtureManagement;
