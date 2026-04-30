INSERT INTO public.nres_buyback_access (user_id, practice_key, access_role, granted_by) VALUES
('31a9cb05-1a66-4c81-811b-8861874c7f5b','brackley','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','brook','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','bt_pcn','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','bugbrooke','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','denton','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','parks','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','springfield','view','system-rollback'),
('31a9cb05-1a66-4c81-811b-8861874c7f5b','towcester','view','system-rollback')
ON CONFLICT DO NOTHING;