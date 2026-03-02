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
import DimensionsEditor from './DimensionsEditor';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  shape: z.string().min(1, 'Shape is required'),
  width: z.number().min(1),
  depth: z.number().min(1),
  height: z.number().min(1),
  is_structural: z.boolean(),
  default_material: z.string().min(1),
  is_active: z.boolean(),
  sort_order: z.number(),
});

type FormData = z.infer<typeof formSchema>;

interface ColumnFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const shapes = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
  { value: 'l-shaped', label: 'L-Shaped' },
  { value: 't-shaped', label: 'T-Shaped' },
];

const materials = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'steel', label: 'Steel' },
  { value: 'wood', label: 'Wood' },
  { value: 'brick', label: 'Brick' },
  { value: 'stone', label: 'Stone' },
  { value: 'composite', label: 'Composite' },
];

const ColumnForm = ({ initialData, onSuccess, onCancel }: ColumnFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      shape: initialData?.shape || 'rectangle',
      width: initialData?.default_dimensions_json?.width || 30,
      depth: initialData?.default_dimensions_json?.depth || 30,
      height: initialData?.default_dimensions_json?.height || 280,
      is_structural: initialData?.is_structural ?? true,
      default_material: initialData?.default_material || 'concrete',
      is_active: initialData?.is_active ?? true,
      sort_order: initialData?.sort_order || 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        shape: data.shape,
        default_dimensions_json: {
          width: data.width,
          depth: data.depth,
          height: data.height,
        },
        is_structural: data.is_structural,
        default_material: data.default_material,
        is_active: data.is_active,
        sort_order: data.sort_order,
      };

      if (initialData) {
        const { error } = await supabase
          .from('column_templates')
          .update(payload)
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Column template updated');

        await supabase.from('admin_activity_log').insert({
          action: 'update',
          entity_type: 'column',
          entity_id: initialData.id,
          entity_name: data.name,
        });
      } else {
        const { data: newItem, error } = await supabase
          .from('column_templates')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        toast.success('Column template created');

        await supabase.from('admin_activity_log').insert({
          action: 'create',
          entity_type: 'column',
          entity_id: newItem.id,
          entity_name: data.name,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving column:', error);
      toast.error('Failed to save column template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name & Shape */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Standard Column" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shape"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shape</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {shapes.map((shape) => (
                      <SelectItem key={shape.value} value={shape.value}>
                        {shape.label}
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
          <Label>Default Dimensions (cm)</Label>
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

        {/* Material */}
        <FormField
          control={form.control}
          name="default_material"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Material</FormLabel>
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

        {/* Structural Toggle */}
        <FormField
          control={form.control}
          name="is_structural"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div>
                <FormLabel className="!mt-0">Structural Column</FormLabel>
                <FormDescription>Load-bearing column (affects calculations)</FormDescription>
              </div>
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
                  <FormDescription>Show in column library</FormDescription>
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

export default ColumnForm;
