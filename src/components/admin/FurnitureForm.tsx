import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DimensionsEditor from './DimensionsEditor';
import ColorPickerField from './ColorPickerField';
import IconSelector from './IconSelector';
import FileUploadField from './FileUploadField';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type slug is required').regex(/^[a-z0-9-]+$/, 'Type must be lowercase with hyphens only'),
  category: z.string().min(1, 'Category is required'),
  width: z.number().min(1, 'Width must be at least 1'),
  depth: z.number().min(1, 'Depth must be at least 1'),
  height: z.number().min(1, 'Height must be at least 1'),
  default_color: z.string().min(1, 'Color is required'),
  icon: z.string().min(1, 'Icon is required'),
  model_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.number(),
  price: z.number().min(0, 'Price must be 0 or greater').optional(),
  currency: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FurnitureFormProps {
  initialData?: {
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
    price?: number | null;
    currency?: string | null;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const categories = [
  { value: 'living', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'dining', label: 'Dining' },
  { value: 'office', label: 'Office' },
  { value: 'storage', label: 'Storage' },
];

const FurnitureForm = ({ initialData, onSuccess, onCancel }: FurnitureFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || '',
      category: initialData?.category || 'living',
      width: initialData?.dimensions_json?.width || 100,
      depth: initialData?.dimensions_json?.depth || 100,
      height: initialData?.dimensions_json?.height || 100,
      default_color: initialData?.default_color || '#8B4513',
      icon: initialData?.icon || 'box',
      model_url: initialData?.model_url || '',
      thumbnail_url: initialData?.thumbnail_url || '',
      is_active: initialData?.is_active ?? true,
      sort_order: initialData?.sort_order || 0,
      price: initialData?.price ?? undefined,
      currency: initialData?.currency || 'USD',
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
        default_color: data.default_color,
        icon: data.icon,
        model_url: data.model_url || null,
        thumbnail_url: data.thumbnail_url || null,
        is_active: data.is_active,
        sort_order: data.sort_order,
        price: data.price ?? null,
        currency: data.currency || 'USD',
        description: (data as any).description || null,
      };

      if (initialData) {
        // Update existing
        const { error } = await supabase
          .from('furniture_templates')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;

        toast.success('Furniture template updated');
        
        // Log activity
        await supabase.from('admin_activity_log').insert({
          action: 'update',
          entity_type: 'furniture',
          entity_id: initialData.id,
          entity_name: data.name,
          changes_json: payload,
        });
      } else {
        // Create new
        const { data: newItem, error } = await supabase
          .from('furniture_templates')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        toast.success('Furniture template created');
        
        // Log activity
        await supabase.from('admin_activity_log').insert({
          action: 'create',
          entity_type: 'furniture',
          entity_id: newItem.id,
          entity_name: data.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving furniture:', error);
      if (error.code === '23505') {
        toast.error('A furniture template with this type already exists');
      } else {
        toast.error('Failed to save furniture template');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generate type from name
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
        {/* Basic Info */}
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
                    placeholder="2-Seat Sofa"
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
                  <Input {...field} placeholder="2-seat-sofa" disabled={!!initialData} />
                </FormControl>
                <FormDescription>Unique identifier (auto-generated)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        {/* Color */}
        <FormField
          control={form.control}
          name="default_color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Color</FormLabel>
              <FormControl>
                <ColorPickerField value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    folder="furniture-thumbnails"
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
                    bucket="models"
                    folder="furniture"
                    accept=".glb,.gltf"
                    label="3D Model"
                    description="GLB or GLTF file (up to 2GB)"
                    maxSizeMB={2048}
                  />
                </FormControl>
                {field.value && (
                  <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs">
                    <p className="text-green-600 font-medium">✓ Model uploaded</p>
                    <p className="text-muted-foreground truncate mt-0.5">{field.value.split('/').pop()}</p>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormDescription>Price in selected currency</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'USD'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Settings */}
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
                  <FormDescription>Show in furniture library</FormDescription>
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

export default FurnitureForm;
