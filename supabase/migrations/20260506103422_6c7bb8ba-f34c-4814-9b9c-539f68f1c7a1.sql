-- Activate NRES service for Michael Chapman
INSERT INTO public.user_service_activations (user_id, service)
VALUES ('499654f6-ea42-4c6e-9b97-19beaea5c834', 'nres')
ON CONFLICT DO NOTHING;

-- Grant NARP identifiable view + export rights for Bugbrooke Medical Practice
INSERT INTO public.user_roles (user_id, practice_id, role, can_view_narp_identifiable, can_export_narp_identifiable)
VALUES ('499654f6-ea42-4c6e-9b97-19beaea5c834', '85cd140c-2980-40df-8e19-0ffc8a9346d5', 'practice_manager', true, true)
ON CONFLICT (user_id, practice_id, role) DO UPDATE
SET can_view_narp_identifiable = true,
    can_export_narp_identifiable = true;