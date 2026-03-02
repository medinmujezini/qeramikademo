import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sofa, 
  Droplet, 
  Grid3X3, 
  Palette, 
  Columns,
  Plus,
  Activity,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  furniture: number;
  fixtures: number;
  tiles: number;
  materials: number;
  columns: number;
  groutColors: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    furniture: 0,
    fixtures: 0,
    tiles: 0,
    materials: 0,
    columns: 0,
    groutColors: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: furnitureCount },
          { count: fixturesCount },
          { count: tilesCount },
          { count: materialsCount },
          { count: columnsCount },
          { count: groutCount },
        ] = await Promise.all([
          supabase.from('furniture_templates').select('*', { count: 'exact', head: true }),
          supabase.from('fixture_templates').select('*', { count: 'exact', head: true }),
          supabase.from('tile_templates').select('*', { count: 'exact', head: true }),
          supabase.from('materials').select('*', { count: 'exact', head: true }),
          supabase.from('column_templates').select('*', { count: 'exact', head: true }),
          supabase.from('grout_colors').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          furniture: furnitureCount || 0,
          fixtures: fixturesCount || 0,
          tiles: tilesCount || 0,
          materials: materialsCount || 0,
          columns: columnsCount || 0,
          groutColors: groutCount || 0,
        });

        // Fetch recent activity
        const { data: activityData } = await supabase
          .from('admin_activity_log')
          .select('id, action, entity_type, entity_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(activityData || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Furniture', value: stats.furniture, icon: Sofa, path: '/admin/furniture', color: 'text-amber-500' },
    { label: 'Fixtures', value: stats.fixtures, icon: Droplet, path: '/admin/fixtures', color: 'text-blue-500' },
    { label: 'Tiles', value: stats.tiles, icon: Grid3X3, path: '/admin/tiles', color: 'text-emerald-500' },
    { label: 'Materials', value: stats.materials, icon: Palette, path: '/admin/materials', color: 'text-purple-500' },
    { label: 'Columns', value: stats.columns, icon: Columns, path: '/admin/columns', color: 'text-orange-500' },
  ];

  const quickActions = [
    { label: 'Add Furniture', icon: Sofa, path: '/admin/furniture?action=new' },
    { label: 'Add Fixture', icon: Droplet, path: '/admin/fixtures?action=new' },
    { label: 'Add Tile', icon: Grid3X3, path: '/admin/tiles?action=new' },
    { label: 'Add Material', icon: Palette, path: '/admin/materials?action=new' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your design assets</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} to={stat.path}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Create new design assets</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  asChild
                >
                  <Link to={action.path}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{action.label}</span>
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest changes to assets</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <span className="font-medium capitalize">{item.action}</span>
                      {' '}
                      <span className="text-muted-foreground">{item.entity_type}</span>
                      {item.entity_name && (
                        <span className="text-muted-foreground">: {item.entity_name}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Asset Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {loading ? '...' : stats.furniture + stats.fixtures}
              </div>
              <div className="text-sm text-muted-foreground">Total Objects</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {loading ? '...' : stats.tiles}
              </div>
              <div className="text-sm text-muted-foreground">Tile Patterns</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {loading ? '...' : stats.materials}
              </div>
              <div className="text-sm text-muted-foreground">PBR Materials</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {loading ? '...' : stats.groutColors}
              </div>
              <div className="text-sm text-muted-foreground">Grout Colors</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
