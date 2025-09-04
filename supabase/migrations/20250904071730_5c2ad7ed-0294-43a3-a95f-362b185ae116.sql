-- Grant proper permissions to anon and authenticated roles for complaints table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;

-- Also grant usage on the sequence if needed
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on the reference generation function
GRANT EXECUTE ON FUNCTION public.generate_complaint_reference() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_complaint_reference() TO authenticated;