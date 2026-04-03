import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FloorPlanProvider } from "@/contexts/FloorPlanContext";
import { MaterialProvider } from "@/contexts/MaterialContext";
import { MEPProvider } from "@/contexts/MEPContext";
import { FurnitureProvider } from "@/contexts/FurnitureContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import EndUserPlatform from "./pages/EndUserPlatform";
import WorkerPlatform from "./pages/WorkerPlatform";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Cornell from "./pages/Cornell";
import Raytracing from "./pages/Raytracing";
import ProductView from "./pages/ProductView";
import WalkthroughPage from "./pages/WalkthroughPage";
import AdminLayout from "./components/admin/AdminLayout";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import Dashboard from "./pages/admin/Dashboard";
import FurnitureManagement from "./pages/admin/FurnitureManagement";
import FixtureManagement from "./pages/admin/FixtureManagement";
import TileManagement from "./pages/admin/TileManagement";
import MaterialsManagement from "./pages/admin/MaterialsManagement";
import ColumnManagement from "./pages/admin/ColumnManagement";
import GroutManagement from "./pages/admin/GroutManagement";
import PlumbingCodes from "./pages/admin/PlumbingCodes";
import DataSeedPage from "./pages/admin/DataSeedPage";
import ImportExportPage from "./pages/admin/ImportExportPage";
import ActivityLog from "./pages/admin/ActivityLog";
import SettingsPage from "./pages/admin/SettingsPage";
import FurnitureScraper from "./pages/admin/FurnitureScraper";
import CurtainModelManagement from "./pages/admin/CurtainModelManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
        <MaterialProvider>
          <FloorPlanProvider>
            <MEPProvider>
              <FurnitureProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    {/* Main Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/design" element={<EndUserPlatform />} />
                    <Route path="/platform" element={<WorkerPlatform />} />
                    <Route path="/auth" element={<Auth />} />
                    
                    {/* Demo Routes */}
                    <Route path="/cornell" element={<Cornell />} />
                    <Route path="/raytracing" element={<Raytracing />} />
                    <Route path="/product-view" element={<ProductView />} />
                    <Route path="/walkthrough" element={<WalkthroughPage />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><Dashboard /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/furniture" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><FurnitureManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/scraper" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><FurnitureScraper /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/fixtures" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><FixtureManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/tiles" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><TileManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/materials" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><MaterialsManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/columns" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><ColumnManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/grout" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><GroutManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/plumbing-codes" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><PlumbingCodes /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/seed" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><DataSeedPage /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/activity" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><ActivityLog /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/settings" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><SettingsPage /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/import-export" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><ImportExportPage /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    <Route path="/admin/curtain-models" element={
                      <ProtectedAdminRoute>
                        <AdminLayout><CurtainModelManagement /></AdminLayout>
                      </ProtectedAdminRoute>
                    } />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </FurnitureProvider>
            </MEPProvider>
          </FloorPlanProvider>
        </MaterialProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
