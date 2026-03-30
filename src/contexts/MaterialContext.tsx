import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PBRMaterial {
  id: string;
  name: string;
  albedo?: string;
  normal?: string;
  roughness?: string;
  metallic?: string;
  ao?: string;
  arm?: string;
  height?: string;
  createdAt: Date;
}

export interface PBRMaterialFiles {
  name: string;
  albedo?: File;
  normal?: File;
  roughness?: File;
  metallic?: File;
  ao?: File;
  arm?: File;
  height?: File;
}

interface MaterialContextType {
  materials: PBRMaterial[];
  loading: boolean;
  addMaterial: (material: Omit<PBRMaterial, 'id' | 'createdAt'>) => Promise<void>;
  addMaterialFromFiles: (material: PBRMaterialFiles) => Promise<void>;
  removeMaterial: (id: string) => Promise<void>;
  updateMaterial: (id: string, updates: Partial<PBRMaterial>) => Promise<void>;
  previewMaterialId: string | null;
  setPreviewMaterialId: (id: string | null) => void;
  getPreviewMaterial: () => PBRMaterial | null;
  refreshMaterials: () => Promise<void>;
}

const MaterialContext = createContext<MaterialContextType | null>(null);

export const MaterialProvider = ({ children }: { children: ReactNode }) => {
  const [materials, setMaterials] = useState<PBRMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);

  const refreshMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMaterials((data || []).map(m => ({
        id: m.id,
        name: m.name,
        albedo: m.albedo_url || undefined,
        normal: m.normal_url || undefined,
        roughness: m.roughness_url || undefined,
        metallic: m.metallic_url || undefined,
        ao: m.ao_url || undefined,
        arm: m.arm_url || undefined,
        height: m.height_url || undefined,
        createdAt: new Date(m.created_at),
      })));
    } catch (error) {
      console.error('Failed to load materials:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMaterials();
  }, [refreshMaterials]);

  /** Upload a File directly to Supabase storage */
  const uploadFile = async (file: File, textureType: string, materialName: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = materialName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeName}_${textureType}_${Date.now()}.${ext}`;
      const filePath = `pbr-materials/${fileName}`;

      console.log(`Uploading ${textureType}: ${file.name} (${file.size} bytes) → ${filePath}`);

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        console.error(`Storage upload error for ${textureType}:`, uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);

      console.log(`Uploaded ${textureType} → ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error(`Failed to upload ${textureType} texture:`, error);
      toast.error(`Failed to upload ${textureType} texture`);
      return null;
    }
  };

  /** Legacy method: accepts string URLs (blob: or https:) */
  const uploadTexture = async (file: string, textureType: string, materialName: string): Promise<string | null> => {
    if (file.startsWith('blob:')) {
      try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Failed to fetch blob: ${response.statusText}`);
        const blob = await response.blob();
        const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const safeName = materialName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeName}_${textureType}_${Date.now()}.${ext}`;
        const filePath = `pbr-materials/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(filePath, blob, { contentType: blob.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('materials')
          .getPublicUrl(filePath);

        return publicUrl;
      } catch (error) {
        console.error(`Failed to upload ${textureType} texture:`, error);
        toast.error(`Failed to upload ${textureType} texture`);
        return null;
      }
    }
    return file;
  };

  const addMaterial = useCallback(async (material: Omit<PBRMaterial, 'id' | 'createdAt'>) => {
    try {
      const [albedo, normal, roughness, metallic, ao, arm, height] = await Promise.all([
        material.albedo ? uploadTexture(material.albedo, 'albedo', material.name) : null,
        material.normal ? uploadTexture(material.normal, 'normal', material.name) : null,
        material.roughness ? uploadTexture(material.roughness, 'roughness', material.name) : null,
        material.metallic ? uploadTexture(material.metallic, 'metallic', material.name) : null,
        material.ao ? uploadTexture(material.ao, 'ao', material.name) : null,
        material.arm ? uploadTexture(material.arm, 'arm', material.name) : null,
        material.height ? uploadTexture(material.height, 'height', material.name) : null,
      ]);

      const { error } = await supabase
        .from('materials')
        .insert({
          name: material.name,
          albedo_url: albedo,
          normal_url: normal,
          roughness_url: roughness,
          metallic_url: metallic,
          ao_url: ao,
          arm_url: arm,
          height_url: height,
        });

      if (error) throw error;

      await refreshMaterials();
      toast.success('Material saved');
    } catch (error) {
      console.error('Failed to add material:', error);
      toast.error('Failed to save material');
    }
  }, [refreshMaterials]);

  /** New method: accepts File objects directly — no blob URL intermediary */
  const addMaterialFromFiles = useCallback(async (material: PBRMaterialFiles) => {
    try {
      const slots: Array<[keyof Omit<PBRMaterialFiles, 'name'>, File | undefined]> = [
        ['albedo', material.albedo],
        ['normal', material.normal],
        ['roughness', material.roughness],
        ['metallic', material.metallic],
        ['ao', material.ao],
        ['arm', material.arm],
        ['height', material.height],
      ];

      // Upload all files in parallel
      const results = await Promise.all(
        slots.map(async ([type, file]) => {
          if (!file) return null;
          return uploadFile(file, type, material.name);
        })
      );

      const [albedo, normal, roughness, metallic, ao, arm, height] = results;

      const { error } = await supabase
        .from('materials')
        .insert({
          name: material.name,
          albedo_url: albedo,
          normal_url: normal,
          roughness_url: roughness,
          metallic_url: metallic,
          ao_url: ao,
          arm_url: arm,
          height_url: height,
        });

      if (error) throw error;

      await refreshMaterials();
      toast.success('Material saved');
    } catch (error) {
      console.error('Failed to add material:', error);
      toast.error('Failed to save material');
    }
  }, [refreshMaterials]);

  const removeMaterial = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (previewMaterialId === id) {
        setPreviewMaterialId(null);
      }
      
      await refreshMaterials();
      toast.success('Material deleted');
    } catch (error) {
      console.error('Failed to delete material:', error);
      toast.error('Failed to delete material');
    }
  }, [previewMaterialId, refreshMaterials]);

  const updateMaterial = useCallback(async (id: string, updates: Partial<PBRMaterial>) => {
    try {
      const dbUpdates: Record<string, string | null> = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.albedo !== undefined) dbUpdates.albedo_url = updates.albedo || null;
      if (updates.normal !== undefined) dbUpdates.normal_url = updates.normal || null;
      if (updates.roughness !== undefined) dbUpdates.roughness_url = updates.roughness || null;
      if (updates.metallic !== undefined) dbUpdates.metallic_url = updates.metallic || null;
      if (updates.ao !== undefined) dbUpdates.ao_url = updates.ao || null;
      if (updates.arm !== undefined) dbUpdates.arm_url = updates.arm || null;
      if (updates.height !== undefined) dbUpdates.height_url = updates.height || null;

      const { error } = await supabase
        .from('materials')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      await refreshMaterials();
    } catch (error) {
      console.error('Failed to update material:', error);
      toast.error('Failed to update material');
    }
  }, [refreshMaterials]);

  const getPreviewMaterial = useCallback(() => {
    if (!previewMaterialId) return null;
    return materials.find(m => m.id === previewMaterialId) || null;
  }, [materials, previewMaterialId]);

  return (
    <MaterialContext.Provider value={{
      materials,
      loading,
      addMaterial,
      addMaterialFromFiles,
      removeMaterial,
      updateMaterial,
      previewMaterialId,
      setPreviewMaterialId,
      getPreviewMaterial,
      refreshMaterials,
    }}>
      {children}
    </MaterialContext.Provider>
  );
};

export const useMaterialContext = () => {
  const context = useContext(MaterialContext);
  if (!context) {
    throw new Error('useMaterialContext must be used within a MaterialProvider');
  }
  return context;
};
