import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DimensionsEditor from './DimensionsEditor';
import IconSelector from './IconSelector';
import FileUploadField from './FileUploadField';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type slug is required').regex(/^[a-z0-9-]+$/, 'Type must be lowercase with hyphens only'),
  category: z.string().min(1, 'Category is required'),
  width: z.number().min(1),
  depth: z.number().min(1),
  height: z.number().min(1),
  clearance_front: z.number().min(0),
  clearance_sides: z.number().min(0),
  clearance_rear: z.number().min(0),
  requires_wall: z.boolean(),
  wall_offset: z.number().min(0),
  trap_height: z.number().nullable(),
  supply_height: z.number().nullable(),
  wattage: z.number().nullable(),
  dfu_value: z.number().min(0),
  gpm_cold: z.number().min(0),
  gpm_hot: z.number().min(0),
  icon: z.string().min(1),
  model_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.number(),
});

type FormData = z.infer<typeof formSchema>;

interface FixtureFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const categories = [
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'utility', label: 'Utility' },
];

const FixtureForm = ({ initialData, onSuccess, onCancel }: FixtureFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || '',
      category: initialData?.category || 'bathroom',
      width: initialData?.dimensions_json?.width || 60,
      depth: initialData?.dimensions_json?.depth || 60,
      height: initialData?.dimensions_json?.height || 80,
      clearance_front: initialData?.clearance_json?.front || 60,
      clearance_sides: initialData?.clearance_json?.sides || 15,
      clearance_rear: initialData?.clearance_json?.rear || 0,
      requires_wall: initialData?.requires_wall ?? false,
      wall_offset: initialData?.wall_offset || 0,
      trap_height: initialData?.trap_height || null,
      supply_height: initialData?.supply_height || null,
      wattage: initialData?.wattage || null,
      dfu_value: initialData?.dfu_value || 1,
      gpm_cold: initialData?.gpm_cold || 1.0,
      gpm_hot: initialData?.gpm_hot || 0.0,
      icon: initialData?.icon || 'droplet',
      model_url: initialData?.model_url || '',
      thumbnail_url: initialData?.thumbnail_url || '',
      is_active: initialData?.is_active ?? true,
      sort_order: initialData?.sort_order || 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        category: data.category,
        dimensions_json: {
          width: data.width,
          depth: data.depth,
          height: data.height,
        },
        clearance_json: {
          front: data.clearance_front,
          sides: data.clearance_sides,
          rear: data.clearance_rear,
        },
        requires_wall: data.requires_wall,
        wall_offset: data.wall_offset,
        trap_height: data.trap_height,
        supply_height: data.supply_height,
        wattage: data.wattage,
        dfu_value: data.dfu_value,
        gpm_cold: data.gpm_cold,
        gpm_hot: data.gpm_hot,
        icon: data.icon,
        model_url: data.model_url || null,
        thumbnail_url: data.thumbnail_url || null,
        is_active: data.is_active,
        sort_order: data.sort_order,
      };

      if (initialData) {
        const { error } = await supabase
          .from('fixture_templates')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Fixture template updated');

        await supabase.from('admin_activity_log').insert({
          action: 'update',
          entity_type: 'fixture',
          entity_id: initialData.id,
          entity_name: data.name,
        });
      } else {
        const { data: newItem, error } = await supabase
          .from('fixture_templates')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        toast.success('Fixture template created');

        await supabase.from('admin_activity_log').insert({
          action: 'create',
          entity_type: 'fixture',
          entity_id: newItem.id,
          entity_name: data.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving fixture:', error);
      if (error.code === '23505') {
        toast.error('A fixture template with this type already exists');
      } else {
        toast.error('Failed to save fixture template');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (name: string) => {
    if (!initialData) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('type', slug);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="plumbing">Plumbing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Name & Type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Toilet"
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="toilet" disabled={!!initialData} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category & Icon */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <IconSelector value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dimensions */}
            <div className="space-y-2">
              <Label>Dimensions (cm)</Label>
              <DimensionsEditor
                width={form.watch('width')}
                depth={form.watch('depth')}
                height={form.watch('height')}
                onChange={(dims) => {
                  form.setValue('width', dims.width);
                  form.setValue('depth', dims.depth);
                  form.setValue('height', dims.height);
                }}
              />
            </div>

            {/* Clearances */}
            <div className="space-y-2">
              <Label>Clearance Requirements (cm)</Label>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="clearance_front"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Front</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clearance_sides"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Sides</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clearance_rear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Rear</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plumbing" className="space-y-4 mt-4">
            {/* Plumbing Codes */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="dfu_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DFU Value</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Drainage Fixture Units</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gpm_cold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cold Water (GPM)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gpm_hot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hot Water (GPM)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Heights */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trap_height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trap Height (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Height of drain trap</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supply_height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supply Height (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Height of water supply</FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Wall Requirements */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requires_wall"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 pt-6">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="!mt-0">Requires Wall</FormLabel>
                      <FormDescription>Must be placed against a wall</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="wall_offset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wall Offset (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Wattage */}
            <FormField
              control={form.control}
              name="wattage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wattage (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormDescription>Electrical power requirement in watts</FormDescription>
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            {/* File Uploads */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="thumbnail_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FileUploadField
                        value={field.value || ''}
                        onChange={field.onChange}
                        bucket="materials"
                        folder="fixture-thumbnails"
                        accept="image/*"
                        label="Thumbnail Image"
                        description="Preview image (PNG, JPG)"
                        maxSizeMB={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FileUploadField
                        value={field.value || ''}
                        onChange={field.onChange}
                        bucket="materials"
                        folder="fixture-models"
                        accept=".glb,.gltf"
                        label="3D Model"
                        description="GLB or GLTF file"
                        maxSizeMB={20}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Active & Sort */}
            <div className="flex items-center justify-between">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="!mt-0">Active</FormLabel>
                      <FormDescription>Show in fixture library</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default FixtureForm;
