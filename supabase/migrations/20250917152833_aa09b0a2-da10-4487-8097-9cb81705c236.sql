-- Assign practices to their respective neighbourhoods
-- Get neighbourhood IDs first for reference
-- Northampton Central: 9d46b0ed-2858-46e5-b93e-7929a46ddd9a
-- Northampton North and East: 8f26a496-ee41-4905-ab7a-a8b861b99576
-- Northampton South and West: 57817910-115b-44fd-9d15-67cd4713e4b8
-- Rural East and South: a5335b1c-715a-4758-9a22-23bad2b17b00
-- Rural North and West: 07a35cdc-2ffb-42cd-8535-7804b31f4a42

-- Northampton Central practices
UPDATE public.gp_practices 
SET neighbourhood_id = '9d46b0ed-2858-46e5-b93e-7929a46ddd9a'
WHERE practice_code IN ('K83012', 'K83025', 'K83014', 'K83027', 'K83029', 'K83042', 'K83050', 'K83056', 'K83077', 'K83621', 'K83043');

-- Northampton North and East practices
UPDATE public.gp_practices 
SET neighbourhood_id = '8f26a496-ee41-4905-ab7a-a8b861b99576'
WHERE practice_code IN ('K83003', 'K83008', 'K83035', 'K83040', 'K83042', 'K83048', 'K83076', 'K83610', 'K83009');

-- Northampton South and West practices
UPDATE public.gp_practices 
SET neighbourhood_id = '57817910-115b-44fd-9d15-67cd4713e4b8'
WHERE practice_code IN ('K83610', 'K83010', 'K83011', 'K83041', 'K83055', 'Y08368', 'K83009');

-- Rural East and South practices
UPDATE public.gp_practices 
SET neighbourhood_id = 'a5335b1c-715a-4758-9a22-23bad2b17b00'
WHERE practice_code IN ('K83018', 'K83022', 'K83049', 'K83052', 'K83066', 'K83068', 'K83070', 'K83620');

-- Rural North and West practices
UPDATE public.gp_practices 
SET neighbourhood_id = '07a35cdc-2ffb-42cd-8535-7804b31f4a42'
WHERE practice_code IN ('K83066', 'K83015', 'K83019', 'K83031', 'K83032', 'K83053', 'K83064');

-- Add a note table to track practices that serve multiple neighbourhoods (due to branch sites)
CREATE TABLE IF NOT EXISTS public.practice_neighbourhood_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    practice_id UUID NOT NULL,
    neighbourhood_id UUID NOT NULL,
    is_main_site BOOLEAN DEFAULT true,
    is_branch_site BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (practice_id) REFERENCES public.gp_practices(id),
    FOREIGN KEY (neighbourhood_id) REFERENCES public.neighbourhoods(id),
    UNIQUE(practice_id, neighbourhood_id)
);

-- Enable RLS for the new table
ALTER TABLE public.practice_neighbourhood_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for the new table
CREATE POLICY "Users can view practice neighbourhood assignments" 
    ON public.practice_neighbourhood_assignments 
    FOR SELECT 
    USING (true);

-- System admins can manage practice neighbourhood assignments
CREATE POLICY "System admins can manage practice neighbourhood assignments" 
    ON public.practice_neighbourhood_assignments 
    FOR ALL 
    USING (is_system_admin(auth.uid()));

-- Now add the multiple neighbourhood assignments for practices with branches
-- K83042 (Park Ave Med Cnt & Kings Heath Practice) serves both Northampton Central and North & East
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '9d46b0ed-2858-46e5-b93e-7929a46ddd9a', true, 'Main site in Northampton Central'
FROM public.gp_practices WHERE practice_code = 'K83042';

INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_branch_site, notes)
SELECT id, '8f26a496-ee41-4905-ab7a-a8b861b99576', true, 'Branch site in Northampton North and East'
FROM public.gp_practices WHERE practice_code = 'K83042';

-- K83610 (Danes Camp Surgery) serves both North & East (branch) and South & West (main)
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '57817910-115b-44fd-9d15-67cd4713e4b8', true, 'Main site in Northampton South and West'
FROM public.gp_practices WHERE practice_code = 'K83610';

INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_branch_site, notes)
SELECT id, '8f26a496-ee41-4905-ab7a-a8b861b99576', true, 'Branch site (Rillwood) in Northampton North and East'
FROM public.gp_practices WHERE practice_code = 'K83610';

-- K83009 (Moulton Surgery) serves both North & East (main) and South & West (branch - University of Northampton Health Care)
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '8f26a496-ee41-4905-ab7a-a8b861b99576', true, 'Main site in Northampton North and East'
FROM public.gp_practices WHERE practice_code = 'K83009';

INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_branch_site, notes)
SELECT id, '57817910-115b-44fd-9d15-67cd4713e4b8', true, 'Branch site (University of Northampton Health Care) in Northampton South and West'
FROM public.gp_practices WHERE practice_code = 'K83009';

-- K83022 (Towcester Medical Centre) serves Rural East and South with branches
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, 'a5335b1c-715a-4758-9a22-23bad2b17b00', true, 'Main site in Rural East and South'
FROM public.gp_practices WHERE practice_code = 'K83022';

-- K83052 (The Parks Medical Practice) serves Rural East and South with multiple branches
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, 'a5335b1c-715a-4758-9a22-23bad2b17b00', true, 'Main site with branches (Grange Park, Hanslope Surgery, Roade Medical Centre) in Rural East and South'
FROM public.gp_practices WHERE practice_code = 'K83052';

-- K83620 (The Brook Health Centre) serves Rural East and South
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, 'a5335b1c-715a-4758-9a22-23bad2b17b00', true, 'Branch of Towcester Medical Centre with Silverstone Surgery branch in Rural East and South'
FROM public.gp_practices WHERE practice_code = 'K83620';

-- K83066 (Weedon Surgery) serves both Rural East and South (Greens Norton branch) and Rural North and West (main)
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '07a35cdc-2ffb-42cd-8535-7804b31f4a42', true, 'Main site in Rural North and West'
FROM public.gp_practices WHERE practice_code = 'K83066';

INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_branch_site, notes)
SELECT id, 'a5335b1c-715a-4758-9a22-23bad2b17b00', true, 'Branch site (Greens Norton Medical Practice) in Rural East and South'
FROM public.gp_practices WHERE practice_code = 'K83066';

-- K83031 (Byfield Medical Centre) serves Rural North and West with branch
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '07a35cdc-2ffb-42cd-8535-7804b31f4a42', true, 'Main site with Woodford Halse Memorial Hall branch in Rural North and West'
FROM public.gp_practices WHERE practice_code = 'K83031';

-- K83032 (Abbey House Medical Practice) serves Rural North and West with branch
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '07a35cdc-2ffb-42cd-8535-7804b31f4a42', true, 'Main site with Monksfield Surgery branch in Rural North and West'
FROM public.gp_practices WHERE practice_code = 'K83032';

-- K83053 (Crick Surgery) serves Rural North and West with branch
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '07a35cdc-2ffb-42cd-8535-7804b31f4a42', true, 'Main site with West Haddon branch in Rural North and West'
FROM public.gp_practices WHERE practice_code = 'K83053';

-- K83064 (Saxon Spires) serves Rural North and West with branch
INSERT INTO public.practice_neighbourhood_assignments (practice_id, neighbourhood_id, is_main_site, notes)
SELECT id, '07a35cdc-2ffb-42cd-8535-7804b31f4a42', true, 'Main site with Brixworth branch in Rural North and West'
FROM public.gp_practices WHERE practice_code = 'K83064';