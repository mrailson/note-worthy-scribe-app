-- Create policy templates table for different types of guidance
CREATE TABLE IF NOT EXISTS public.policy_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    policy_type TEXT NOT NULL, -- 'local_guidance', 'traffic_light', 'formulary', etc.
    region TEXT NOT NULL DEFAULT 'Northamptonshire ICB',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    configuration JSONB DEFAULT '{}',
    UNIQUE(name, region)
);

-- Create practice policy assignments table
CREATE TABLE IF NOT EXISTS public.practice_policy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    policy_template_id UUID NOT NULL REFERENCES public.policy_templates(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    configuration_overrides JSONB DEFAULT '{}',
    notes TEXT,
    UNIQUE(practice_id, policy_template_id)
);

-- Enable RLS on both tables
ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_policy_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for policy_templates
CREATE POLICY "System admins can manage policy templates"
ON public.policy_templates
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Authenticated users can view policy templates"
ON public.policy_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS policies for practice_policy_assignments
CREATE POLICY "System admins can manage practice policy assignments"
ON public.practice_policy_assignments
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Practice managers can view their practice assignments"
ON public.practice_policy_assignments
FOR SELECT
TO authenticated
USING (
    practice_id = ANY(get_user_practice_ids(auth.uid())) OR
    is_system_admin(auth.uid())
);

-- Insert the Northamptonshire ICB Local Policy Guidance template
INSERT INTO public.policy_templates (
    name,
    description,
    policy_type,
    region,
    is_active,
    configuration
) VALUES (
    'Local Policy Guidance',
    'Northamptonshire ICB - Enable Northamptonshire Integrated Care Board local guidance and traffic-light medicines policy',
    'local_guidance',
    'Northamptonshire ICB',
    true,
    '{
        "includes_traffic_light": true,
        "includes_formulary": true,
        "includes_pathways": true,
        "status": "Active",
        "description": "Local medicines policies, pathways, and traffic-light guidance enabled"
    }'::jsonb
)
ON CONFLICT (name, region) DO UPDATE SET
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = now();

-- Function to assign policy to all practices in a region
CREATE OR REPLACE FUNCTION public.assign_policy_to_all_practices(
    p_policy_template_id UUID,
    p_assigned_by UUID DEFAULT auth.uid()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    practice_count INTEGER := 0;
    practice_record RECORD;
BEGIN
    -- Only system admins can execute this function
    IF NOT is_system_admin(p_assigned_by) THEN
        RAISE EXCEPTION 'Only system administrators can assign policies to all practices';
    END IF;

    -- Insert assignments for all practices that don't already have this policy
    FOR practice_record IN 
        SELECT DISTINCT id FROM public.gp_practices
        WHERE id NOT IN (
            SELECT practice_id 
            FROM public.practice_policy_assignments 
            WHERE policy_template_id = p_policy_template_id
        )
    LOOP
        INSERT INTO public.practice_policy_assignments (
            practice_id,
            policy_template_id,
            assigned_by,
            is_active,
            notes
        ) VALUES (
            practice_record.id,
            p_policy_template_id,
            p_assigned_by,
            true,
            'Auto-assigned to all Northamptonshire practices'
        );
        
        practice_count := practice_count + 1;
    END LOOP;

    -- Log the bulk assignment
    PERFORM public.log_system_activity(
        'practice_policy_assignments',
        'BULK_POLICY_ASSIGNMENT',
        p_policy_template_id,
        NULL,
        jsonb_build_object(
            'policy_template_id', p_policy_template_id,
            'practices_assigned', practice_count,
            'assigned_by', p_assigned_by,
            'assignment_type', 'bulk_all_practices'
        )
    );

    RETURN practice_count;
END;
$$;

-- Function to get practice policy status
CREATE OR REPLACE FUNCTION public.get_practice_policy_status(p_practice_id UUID)
RETURNS TABLE(
    policy_name TEXT,
    policy_type TEXT,
    region TEXT,
    is_active BOOLEAN,
    assigned_at TIMESTAMP WITH TIME ZONE,
    configuration JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT 
        pt.name,
        pt.policy_type,
        pt.region,
        ppa.is_active,
        ppa.assigned_at,
        COALESCE(ppa.configuration_overrides, pt.configuration) as configuration
    FROM public.practice_policy_assignments ppa
    JOIN public.policy_templates pt ON pt.id = ppa.policy_template_id
    WHERE ppa.practice_id = p_practice_id
      AND ppa.is_active = true
      AND pt.is_active = true
    ORDER BY ppa.assigned_at DESC;
$$;

-- Now assign the Local Policy Guidance to all practices
DO $$
DECLARE
    template_id UUID;
    assigned_count INTEGER;
BEGIN
    -- Get the policy template ID
    SELECT id INTO template_id 
    FROM public.policy_templates 
    WHERE name = 'Local Policy Guidance' 
      AND region = 'Northamptonshire ICB';
    
    -- Assign to all practices
    IF template_id IS NOT NULL THEN
        SELECT public.assign_policy_to_all_practices(template_id) INTO assigned_count;
        RAISE NOTICE 'Assigned Local Policy Guidance to % practices', assigned_count;
    ELSE
        RAISE EXCEPTION 'Policy template not found';
    END IF;
END $$;