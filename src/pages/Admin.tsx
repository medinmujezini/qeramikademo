import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PBRMaterialPanel from '@/components/admin/PBRMaterialPanel';

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="materials" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="materials" className="gap-2">
              <Palette className="h-4 w-4" />
              Materials
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2">
              <Box className="h-4 w-4" />
              Assets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-4">
            <PBRMaterialPanel />
          </TabsContent>

          <TabsContent value="assets">
            <div className="text-center py-12 text-muted-foreground">
              <Box className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>3D asset management coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
