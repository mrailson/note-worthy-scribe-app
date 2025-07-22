-- Insert default response templates (fixed syntax)
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user ID
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Insert templates only if they don't exist
    INSERT INTO public.complaint_templates (name, template_type, subject, content, created_by)
    SELECT * FROM (VALUES
      ('Standard Acknowledgement', 'acknowledgement', 'Acknowledgement of Your Complaint - Ref: {reference_number}', 
       'Dear {patient_name},

Thank you for bringing your concerns to our attention. We have received your complaint (Reference: {reference_number}) and take all feedback seriously.

We aim to provide a full response within 20 working days. If you have any questions in the meantime, please contact our complaints team.

Yours sincerely,
Practice Complaints Team', first_user_id),
      
      ('Standard Response', 'full_response', 'Response to Your Complaint - Ref: {reference_number}',
       'Dear {patient_name},

Following our investigation into your complaint (Reference: {reference_number}), I would like to provide you with our findings and response.

{response_content}

If you are not satisfied with this response, you have the right to refer your complaint to the Parliamentary and Health Service Ombudsman.

Yours sincerely,
Practice Manager', first_user_id),
      
      ('Escalation Letter', 'escalation', 'Escalation of Complaint - Ref: {reference_number}',
       'Dear {patient_name},

Your complaint (Reference: {reference_number}) is being escalated for further review as it has not been resolved within our standard timeframe.

A senior member of our team will be in contact within 5 working days.

Yours sincerely,
Practice Manager', first_user_id)
    ) AS t(name, template_type, subject, content, created_by)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.complaint_templates ct 
      WHERE ct.name = t.name
    );
  END IF;
END $$;