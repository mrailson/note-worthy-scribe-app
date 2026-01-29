import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { useResponsibilityAssignments } from '@/hooks/useResponsibilityAssignments';
import { PRACTICE_ROLES, type Responsibility } from '@/types/responsibilityTypes';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  assigned_to_role: z.string().optional(),
  assigned_to_user_id: z.string().optional(),
  notes: z.string().optional(),
  start_date: z.date(),
  custom_due_date: z.date().optional().nullable(),
  create_instances: z.boolean(),
}).refine((data) => data.assigned_to_role || data.assigned_to_user_id, {
  message: 'Please select either a role or a specific user',
  path: ['assigned_to_role'],
});

type FormData = z.infer<typeof formSchema>;

interface AssignmentFormProps {
  responsibility: Responsibility;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AssignmentForm({ responsibility, onSuccess, onCancel }: AssignmentFormProps) {
  const { createAssignment, saving } = useResponsibilityAssignments();
  const [assignmentType, setAssignmentType] = useState<'role' | 'user'>('role');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assigned_to_role: undefined,
      assigned_to_user_id: undefined,
      notes: '',
      start_date: new Date(),
      custom_due_date: null,
      create_instances: true,
    },
  });

  const handleSubmit = async (data: FormData) => {
    const result = await createAssignment({
      responsibility_id: responsibility.id,
      assigned_to_user_id: assignmentType === 'user' ? data.assigned_to_user_id || null : null,
      assigned_to_role: assignmentType === 'role' ? data.assigned_to_role || null : null,
      notes: data.notes || '',
      start_date: format(data.start_date, 'yyyy-MM-dd'),
      custom_due_date: data.custom_due_date ? format(data.custom_due_date, 'yyyy-MM-dd') : null,
      create_instances: data.create_instances,
    });

    if (result) {
      onSuccess();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Assignment Type Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={assignmentType === 'role' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssignmentType('role')}
          >
            Assign to Role
          </Button>
          <Button
            type="button"
            variant={assignmentType === 'user' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssignmentType('user')}
          >
            Assign to Person
          </Button>
        </div>

        {assignmentType === 'role' ? (
          <FormField
            control={form.control}
            name="assigned_to_role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRACTICE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Assign this responsibility to a practice role
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="assigned_to_user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="User assignment coming soon..."
                    disabled
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  User selection will be available in a future update
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="start_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "d MMMM yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                When should this assignment start?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="custom_due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Custom Due Date (Optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "d MMMM yyyy")
                      ) : (
                        <span>Use default due date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value || undefined}
                    onSelect={field.onChange}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                Override the default due date for this assignment
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Any additional notes for this assignment..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="create_instances"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Create Task Instances</FormLabel>
                <FormDescription>
                  Automatically generate task instances based on frequency
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
            {saving ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
