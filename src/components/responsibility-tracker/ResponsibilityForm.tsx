import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import type { Responsibility, FrequencyType } from '@/types/responsibilityTypes';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  frequency_type: z.enum(['annual', 'monthly', 'quarterly', 'weekly', 'one-off', 'custom']),
  frequency_value: z.number().optional().nullable(),
  typical_due_month: z.number().min(1).max(12).optional().nullable(),
  typical_due_day: z.number().min(1).max(31).optional().nullable(),
  is_mandatory: z.boolean(),
  reference_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ResponsibilityFormProps {
  responsibility?: Responsibility | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResponsibilityForm({ responsibility, onSuccess, onCancel }: ResponsibilityFormProps) {
  const { categories, createResponsibility, updateResponsibility, saving } = useResponsibilities();
  const [showCustomFrequency, setShowCustomFrequency] = useState(
    responsibility?.frequency_type === 'custom'
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: responsibility?.title || '',
      description: responsibility?.description || '',
      category_id: responsibility?.category_id || undefined,
      frequency_type: (responsibility?.frequency_type || 'annual') as FrequencyType,
      frequency_value: responsibility?.frequency_value || null,
      typical_due_month: responsibility?.typical_due_month || null,
      typical_due_day: responsibility?.typical_due_day || null,
      is_mandatory: responsibility?.is_mandatory || false,
      reference_url: responsibility?.reference_url || '',
    },
  });

  const handleSubmit = async (data: FormData) => {
    const formData = {
      title: data.title,
      description: data.description || '',
      category_id: data.category_id || null,
      frequency_type: data.frequency_type,
      frequency_value: data.frequency_type === 'custom' ? data.frequency_value : null,
      typical_due_month: data.typical_due_month,
      typical_due_day: data.typical_due_day,
      is_mandatory: data.is_mandatory,
      reference_url: data.reference_url || '',
    };

    if (responsibility) {
      const success = await updateResponsibility(responsibility.id, formData);
      if (success) onSuccess();
    } else {
      const result = await createResponsibility(formData);
      if (result) onSuccess();
    }
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Type 2 Pension Forms" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe this responsibility..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
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
          name="frequency_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency *</FormLabel>
              <Select 
                onValueChange={(value) => {
                  field.onChange(value);
                  setShowCustomFrequency(value === 'custom');
                }} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="one-off">One-off</SelectItem>
                  <SelectItem value="custom">Custom (every X months)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showCustomFrequency && (
          <FormField
            control={form.control}
            name="frequency_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Every X months</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={1} 
                    placeholder="e.g., 6"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="typical_due_month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typical Due Month</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
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
            name="typical_due_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typical Due Day</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={1} 
                    max={31}
                    placeholder="e.g., 15"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="reference_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormDescription>Link to guidance or documentation</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_mandatory"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Mandatory</FormLabel>
                <FormDescription>
                  Mark this as a mandatory responsibility
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : responsibility ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
