-- =====================================================
-- POLICY MANAGEMENT SERVICE - DATABASE SCHEMA
-- =====================================================

-- 1. Create policy_reference_library table
-- Stores the master list of 60+ policies with CQC KLOE mapping
CREATE TABLE public.policy_reference_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Clinical', 'Information Governance', 'Health & Safety', 'HR', 'Patient Services', 'Business Continuity')),
    cqc_kloe TEXT NOT NULL CHECK (cqc_kloe IN ('Safe', 'Effective', 'Caring', 'Responsive', 'Well-led')),
    priority TEXT NOT NULL CHECK (priority IN ('Essential', 'Recommended', 'Service-specific')),
    guidance_sources JSONB DEFAULT '[]'::jsonb,
    required_services TEXT[] DEFAULT '{}',
    required_roles TEXT[] DEFAULT '{}',
    description TEXT,
    template_sections JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create policy_generations table
-- Logs each policy generation for audit trail
CREATE TABLE public.policy_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    practice_id UUID NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
    policy_reference_id UUID REFERENCES public.policy_reference_library(id) ON DELETE SET NULL,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('new', 'update')),
    policy_name TEXT NOT NULL,
    input_document_url TEXT,
    generated_content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    gap_analysis JSONB,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Extend gp_practices table with policy-specific personnel columns
ALTER TABLE public.gp_practices
    ADD COLUMN IF NOT EXISTS practice_manager_name TEXT,
    ADD COLUMN IF NOT EXISTS lead_gp_name TEXT,
    ADD COLUMN IF NOT EXISTS caldicott_guardian TEXT,
    ADD COLUMN IF NOT EXISTS dpo_name TEXT,
    ADD COLUMN IF NOT EXISTS safeguarding_lead_adults TEXT,
    ADD COLUMN IF NOT EXISTS safeguarding_lead_children TEXT,
    ADD COLUMN IF NOT EXISTS infection_control_lead TEXT,
    ADD COLUMN IF NOT EXISTS complaints_lead TEXT,
    ADD COLUMN IF NOT EXISTS health_safety_lead TEXT,
    ADD COLUMN IF NOT EXISTS fire_safety_officer TEXT,
    ADD COLUMN IF NOT EXISTS list_size INTEGER,
    ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS local_contacts JSONB DEFAULT '{}'::jsonb;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_policy_reference_category ON public.policy_reference_library(category);
CREATE INDEX IF NOT EXISTS idx_policy_reference_priority ON public.policy_reference_library(priority);
CREATE INDEX IF NOT EXISTS idx_policy_reference_cqc_kloe ON public.policy_reference_library(cqc_kloe);
CREATE INDEX IF NOT EXISTS idx_policy_reference_active ON public.policy_reference_library(is_active);

CREATE INDEX IF NOT EXISTS idx_policy_generations_user ON public.policy_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_generations_practice ON public.policy_generations(practice_id);
CREATE INDEX IF NOT EXISTS idx_policy_generations_created ON public.policy_generations(created_at DESC);

-- 5. Enable RLS on new tables
ALTER TABLE public.policy_reference_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_generations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for policy_reference_library (read-only for all authenticated users)
CREATE POLICY "Anyone can view active policies"
    ON public.policy_reference_library
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- 7. RLS Policies for policy_generations
-- Users can only view their own generations
CREATE POLICY "Users can view their own policy generations"
    ON public.policy_generations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can create their own policy generations"
    ON public.policy_generations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations
CREATE POLICY "Users can update their own policy generations"
    ON public.policy_generations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete their own policy generations"
    ON public.policy_generations
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 8. Add updated_at trigger for policy_generations
CREATE TRIGGER update_policy_generations_updated_at
    BEFORE UPDATE ON public.policy_generations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Add updated_at trigger for policy_reference_library
CREATE TRIGGER update_policy_reference_library_updated_at
    BEFORE UPDATE ON public.policy_reference_library
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();