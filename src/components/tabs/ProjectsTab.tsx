import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { 
  Save, FolderOpen, Plus, Trash2, LogOut, 
  User, Clock, FileJson, Loader2 
} from 'lucide-react';
import type { FloorPlan } from '@/types/floorPlan';

interface Project {
  id: string;
  name: string;
  floor_plan_json: FloorPlan;
  created_at: string;
  updated_at: string;
}

export const ProjectsTab: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { floorPlan, loadFloorPlan, resetFloorPlan } = useFloorPlanContext();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(floorPlan.name);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to load projects');
      console.error(error);
    } else {
      setProjects((data || []).map(p => ({
        ...p,
        floor_plan_json: p.floor_plan_json as unknown as FloorPlan
      })));
    }
    setLoading(false);
  };

  const saveProject = async () => {
    if (!user) return;
    setSaving(true);

    const floorPlanData = JSON.parse(JSON.stringify({ ...floorPlan, name: projectName }));

    let error;
    
    if (currentProjectId) {
      const result = await supabase
        .from('projects')
        .update({ name: projectName, floor_plan_json: floorPlanData })
        .eq('id', currentProjectId);
      error = result.error;
    } else {
      const result = await supabase
        .from('projects')
        .insert({ name: projectName, floor_plan_json: floorPlanData, user_id: user.id })
        .select()
        .single();
      error = result.error;
      if (!error && result.data) {
        setCurrentProjectId(result.data.id);
      }
    }

    if (error) {
      toast.error('Failed to save project');
      console.error(error);
    } else {
      toast.success('Project saved!');
      loadProjects();
    }
    setSaving(false);
  };

  const loadProject = (project: Project) => {
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    loadFloorPlan(project.floor_plan_json);
    toast.success(`Loaded: ${project.name}`);
  };

  const deleteProject = async (projectId: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      toast.error('Failed to delete project');
    } else {
      toast.success('Project deleted');
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
        resetFloorPlan();
      }
      loadProjects();
    }
  };

  const createNewProject = () => {
    setCurrentProjectId(null);
    setProjectName('New Project');
    resetFloorPlan();
    toast.info('Started new project');
  };

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center p-8 relative">
        <GlassCard className="max-w-md w-full" variant="premium">
          <GlassCardContent className="pt-6">
            <AuthForm />
          </GlassCardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full relative p-6">
      <div className="max-w-6xl mx-auto h-full flex gap-6">
        {/* Project List */}
        <GlassCard className="w-80 shrink-0 h-fit max-h-[calc(100vh-10rem)]">
          <GlassCardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <GlassCardTitle className="text-sm">My Projects</GlassCardTitle>
              <Button variant="outline" size="sm" onClick={createNewProject}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : projects.length > 0 ? (
                <div className="space-y-2">
                  {projects.map(project => (
                    <div 
                      key={project.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        currentProjectId === project.id 
                          ? 'border-primary bg-primary/10' 
                          : 'border-white/10 hover:bg-white/5'
                      }`}
                      onClick={() => loadProject(project)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(project.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {(project.floor_plan_json as FloorPlan).walls?.length || 0} walls
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {(project.floor_plan_json as FloorPlan).fixtures?.length || 0} fixtures
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No projects yet</p>
                  <p className="text-xs mt-1">Create your first project to get started</p>
                </div>
              )}
            </ScrollArea>
          </GlassCardContent>
        </GlassCard>

        {/* Current Project */}
        <div className="flex-1 space-y-4">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Current Project
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="bg-white/5 border-white/10"
                  />
                  <Button onClick={saveProject} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="ml-2">Save</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-sm text-muted-foreground">Walls</p>
                  <p className="text-2xl font-bold">{floorPlan.walls.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fixtures</p>
                  <p className="text-2xl font-bold">{floorPlan.fixtures.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Doors</p>
                  <p className="text-2xl font-bold">{floorPlan.doors.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Windows</p>
                  <p className="text-2xl font-bold">{floorPlan.windows.length}</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* User Info */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Account
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} saved
                  </p>
                </div>
                <Button variant="outline" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
