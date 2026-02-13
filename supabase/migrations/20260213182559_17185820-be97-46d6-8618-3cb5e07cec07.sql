
-- Create a secure RPC for public survey access that returns only necessary fields
-- This replaces the broad anon SELECT policies that expose created_by, practice_id, etc.

CREATE OR REPLACE FUNCTION public.get_public_survey(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_survey record;
  v_practice record;
  v_questions json;
BEGIN
  -- Look up survey by short_code or public_token, only if active
  IF length(p_token) = 36 AND p_token ~ '^[0-9a-f-]+$' THEN
    SELECT id, title, description, is_anonymous, practice_id, show_practice_logo, branding_level
    INTO v_survey
    FROM public.surveys
    WHERE public_token::text = p_token AND status = 'active';
  ELSE
    SELECT id, title, description, is_anonymous, practice_id, show_practice_logo, branding_level
    INTO v_survey
    FROM public.surveys
    WHERE short_code = p_token AND status = 'active';
  END IF;

  IF v_survey IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get practice branding if needed (return branding info, NOT the practice_id)
  IF v_survey.show_practice_logo OR v_survey.branding_level != 'none' THEN
    SELECT practice_name, address, email, phone, practice_logo_url, logo_url
    INTO v_practice
    FROM public.practice_details
    WHERE id = v_survey.practice_id;
  END IF;

  -- Get questions
  SELECT json_agg(q ORDER BY q.display_order)
  INTO v_questions
  FROM (
    SELECT id, question_text, question_type, options, is_required, display_order
    FROM public.survey_questions
    WHERE survey_id = v_survey.id
  ) q;

  -- Return combined result WITHOUT practice_id or created_by
  RETURN json_build_object(
    'survey', json_build_object(
      'id', v_survey.id,
      'title', v_survey.title,
      'description', v_survey.description,
      'is_anonymous', v_survey.is_anonymous,
      'show_practice_logo', v_survey.show_practice_logo,
      'branding_level', v_survey.branding_level
    ),
    'practice', CASE 
      WHEN v_practice IS NOT NULL THEN json_build_object(
        'practice_name', v_practice.practice_name,
        'address', v_practice.address,
        'email', v_practice.email,
        'phone', v_practice.phone,
        'practice_logo_url', v_practice.practice_logo_url,
        'logo_url', v_practice.logo_url
      )
      ELSE NULL
    END,
    'questions', COALESCE(v_questions, '[]'::json)
  );
END;
$$;

-- Drop the broad anon SELECT policies that expose all survey data
DROP POLICY IF EXISTS "Public can view active surveys by token" ON public.surveys;
DROP POLICY IF EXISTS "Public can view questions for active surveys" ON public.survey_questions;
