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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ColorPickerField from './ColorPickerField';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  material: z.string().min(1, 'Material is required'),
  width: z.number().min(1, 'Width must be at least 1'),
  height: z.number().min(1, 'Height must be at least 1'),
  price_per_unit: z.number().min(0),
  default_color: z.string().min(1, 'Color is required'),
  min_curve_radius: z.number().nullable(),
  is_flexible: z.boolean(),
  thumbnail_url: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.number(),
});

type FormData = z.infer<typeof formSchema>;

interface TileFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const materials = [
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'glass', label: 'Glass' },
  { value: 'marble', label: 'Marble' },
  { value: 'granite', label: 'Granite' },
  { value: 'slate', label: 'Slate' },
  { value: 'mosaic', label: 'Mosaic' },
];

const TileForm = ({ initialData, onSuccess, onCancel }: TileFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      material: initialData?.material || 'ceramic',
      width: initialData?.dimensions_json?.width || 30,
      height: initialData?.dimensions_json?.height || 30,
      price_per_unit: initialData?.price_per_unit || 0,
      default_color: initialData?.default_color || '#FFFFFF',
      min_curve_radius: initialData?.min_curve_radius || null,
      is_flexible: initialData?.is_flexible ?? false,
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
        material: data.material,
        dimensions_json: {
          width: data.width,
          height: data.height,
        },
        price_per_unit: data.price_per_unit,
        default_color: data.default_color,
        min_curve_radius: data.min_curve_radius,
        is_flexible: data.is_flexible,
        thumbnail_url: data.thumbnail_url || null,
        is_active: data.is_active,
        sort_order: data.sort_order,
      };

      if (initialData) {
        const { error } = await supabase
          .from('tile_templates')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Tile template updated');

        await supabase.from('admin_activity_log').insert({
          action: 'update',
          entity_type: 'tile',
          entity_id: initialData.id,
          entity_name: data.name,
        });
      } else {
        const { data: newItem, error } = await supabase
          .from('tile_templates')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        toast.success('Tile template created');

        await supabase.from('admin_activity_log').insert({
          action: 'create',
          entity_type: 'tile',
          entity_id: newItem.id,
          entity_name: data.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving tile:', error);
      toast.error('Failed to save tile template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name & Material */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="White Subway Tile" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="material"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Material</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {materials.map((mat) => (
                      <SelectItem key={mat.value} value={mat.value}>
                        {mat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dimensions */}
        <div className="space-y-2">
          <Label>Dimensions (cm)</Label>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Width</FormLabel>
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
              name="height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Height</FormLabel>
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

        {/* Price */}
        <FormField
          control={form.control}
          name="price_per_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price per Unit ($)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01"
                  {...field} 
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>Cost per tile unit</FormDescription>
            </FormItem>
          )}
        />

        {/* Flexibility */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="is_flexible"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 pt-6">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div>
                  <FormLabel className="!mt-0">Flexible</FormLabel>
                  <FormDescription>Can be applied to curved surfaces</FormDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="min_curve_radius"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Curve Radius (cm)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    disabled={!form.watch('is_flexible')}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Thumbnail */}
        <FormField
          control={form.control}
          name="thumbnail_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thumbnail URL (optional)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://..." />
              </FormControl>
            </FormItem>
          )}
        />

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
                  <FormDescription>Show in tile catalog</FormDescription>
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

export default TileForm;
