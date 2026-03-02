import PBRMaterialPanel from '@/components/admin/PBRMaterialPanel';

const MaterialsManagement = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PBR Materials</h1>
        <p className="text-muted-foreground">Manage physically-based rendering materials</p>
      </div>
      
      <PBRMaterialPanel />
    </div>
  );
};

export default MaterialsManagement;
