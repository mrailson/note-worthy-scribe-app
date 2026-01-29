-- Create function to get user's practice_id from user_roles (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_practice_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT practice_id FROM public.user_roles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Create pm_responsibility_categories table
CREATE TABLE public.pm_responsibility_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    practice_id UUID NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
    colour TEXT DEFAULT 'blue',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pm_responsibilities table
CREATE TABLE public.pm_responsibilities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    practice_id UUID NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.pm_responsibility_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    frequency_type TEXT NOT NULL DEFAULT 'annual' CHECK (frequency_type IN ('annual', 'monthly', 'quarterly', 'weekly', 'one-off', 'custom')),
    frequency_value INTEGER,
    typical_due_month INTEGER CHECK (typical_due_month IS NULL OR (typical_due_month >= 1 AND typical_due_month <= 12)),
    typical_due_day INTEGER CHECK (typical_due_day IS NULL OR (typical_due_day >= 1 AND typical_due_day <= 31)),
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    reference_url TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create pm_responsibility_assignments table
CREATE TABLE public.pm_responsibility_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    responsibility_id UUID NOT NULL REFERENCES public.pm_responsibilities(id) ON DELETE CASCADE,
    assigned_to_user_id UUID,
    assigned_to_role TEXT,
    assigned_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT assignment_target_check CHECK (assigned_to_user_id IS NOT NULL OR assigned_to_role IS NOT NULL)
);

-- Create pm_responsibility_instances table
CREATE TABLE public.pm_responsibility_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    responsibility_id UUID NOT NULL REFERENCES public.pm_responsibilities(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.pm_responsibility_assignments(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'not_applicable')),
    evidence_notes TEXT,
    evidence_url TEXT,
    reminder_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_pm_categories_practice ON public.pm_responsibility_categories(practice_id);
CREATE INDEX idx_pm_responsibilities_practice ON public.pm_responsibilities(practice_id);
CREATE INDEX idx_pm_responsibilities_category ON public.pm_responsibilities(category_id);
CREATE INDEX idx_pm_responsibilities_active ON public.pm_responsibilities(practice_id, is_active);
CREATE INDEX idx_pm_assignments_responsibility ON public.pm_responsibility_assignments(responsibility_id);
CREATE INDEX idx_pm_assignments_user ON public.pm_responsibility_assignments(assigned_to_user_id);
CREATE INDEX idx_pm_assignments_role ON public.pm_responsibility_assignments(assigned_to_role);
CREATE INDEX idx_pm_instances_responsibility ON public.pm_responsibility_instances(responsibility_id);
CREATE INDEX idx_pm_instances_assignment ON public.pm_responsibility_instances(assignment_id);
CREATE INDEX idx_pm_instances_due_date ON public.pm_responsibility_instances(due_date);
CREATE INDEX idx_pm_instances_status ON public.pm_responsibility_instances(status);

-- Enable RLS on all tables
ALTER TABLE public.pm_responsibility_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_responsibility_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_responsibility_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pm_responsibility_categories
CREATE POLICY "Users can view categories for their practice"
ON public.pm_responsibility_categories
FOR SELECT
USING (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can insert categories"
ON public.pm_responsibility_categories
FOR INSERT
WITH CHECK (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can update categories"
ON public.pm_responsibility_categories
FOR UPDATE
USING (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can delete categories"
ON public.pm_responsibility_categories
FOR DELETE
USING (practice_id = public.get_user_practice_id(auth.uid()));

-- RLS Policies for pm_responsibilities
CREATE POLICY "Users can view responsibilities for their practice"
ON public.pm_responsibilities
FOR SELECT
USING (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can insert responsibilities"
ON public.pm_responsibilities
FOR INSERT
WITH CHECK (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can update responsibilities"
ON public.pm_responsibilities
FOR UPDATE
USING (practice_id = public.get_user_practice_id(auth.uid()));

CREATE POLICY "Practice managers can delete responsibilities"
ON public.pm_responsibilities
FOR DELETE
USING (practice_id = public.get_user_practice_id(auth.uid()));

-- RLS Policies for pm_responsibility_assignments
CREATE POLICY "Users can view assignments for their practice responsibilities"
ON public.pm_responsibility_assignments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Practice managers can insert assignments"
ON public.pm_responsibility_assignments
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Practice managers can update assignments"
ON public.pm_responsibility_assignments
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Practice managers can delete assignments"
ON public.pm_responsibility_assignments
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

-- RLS Policies for pm_responsibility_instances
CREATE POLICY "Users can view instances for their practice responsibilities"
ON public.pm_responsibility_instances
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Practice managers can insert instances"
ON public.pm_responsibility_instances
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Users can update their assigned instances"
ON public.pm_responsibility_instances
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

CREATE POLICY "Practice managers can delete instances"
ON public.pm_responsibility_instances
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.pm_responsibilities r
        WHERE r.id = responsibility_id
        AND r.practice_id = public.get_user_practice_id(auth.uid())
    )
);

-- Create trigger for updated_at timestamps
CREATE TRIGGER update_pm_responsibilities_updated_at
BEFORE UPDATE ON public.pm_responsibilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pm_assignments_updated_at
BEFORE UPDATE ON public.pm_responsibility_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pm_instances_updated_at
BEFORE UPDATE ON public.pm_responsibility_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();