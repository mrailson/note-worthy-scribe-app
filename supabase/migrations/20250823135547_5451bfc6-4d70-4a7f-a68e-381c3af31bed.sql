-- Create traffic light medicines table
CREATE TABLE public.traffic_light_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bnf_chapter text,
  status_enum text NOT NULL CHECK (status_enum IN ('DOUBLE_RED', 'RED', 'SPECIALIST_INITIATED', 'SPECIALIST_RECOMMENDED', 'GREY', 'UNKNOWN')),
  status_raw text,
  detail_url text,
  notes text,
  prior_approval_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, bnf_chapter)
);

-- Enable Row Level Security
ALTER TABLE public.traffic_light_medicines ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read traffic light medicines
CREATE POLICY "Authenticated users can view traffic light medicines" 
ON public.traffic_light_medicines 
FOR SELECT 
TO authenticated
USING (true);

-- Create policy to allow system admins to manage traffic light medicines
CREATE POLICY "System admins can manage traffic light medicines" 
ON public.traffic_light_medicines 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_traffic_light_medicines_updated_at
  BEFORE UPDATE ON public.traffic_light_medicines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Northamptonshire ICB traffic light medicines data
INSERT INTO public.traffic_light_medicines (name, bnf_chapter, status_enum, status_raw) VALUES
('Atomoxetine (adult)', '04 - Central nervous system', 'SPECIALIST_INITIATED', 'Specialist Initiated'),
('Atomoxetine (children and adolescents)', '04 - Central nervous system', 'SPECIALIST_INITIATED', 'Specialist Initiated'),
('Atorvastatin (Lipitor) Chewable', '02 - Cardiovascular system', 'DOUBLE_RED', 'double red'),
('Atorvastatin 30mg (not routinely commissioned - IFR only)', '02 - Cardiovascular system', 'DOUBLE_RED', 'double red'),
('Atorvastatin suspension', '02 - Cardiovascular system', 'DOUBLE_RED', 'double red'),
('Atrovastatin 60mg (not routinely commissioned - IFR only)', '02 - Cardiovascular system', 'DOUBLE_RED', 'double red'),
('Avanafil (Spedra)', '07 Obstetrics, gynaecology, urinary–tract disorder', 'DOUBLE_RED', 'double red'),
('Avatrombopag', '09 - Nutrition and blood', 'RED', 'red'),
('Aveeno products (Zeroveen and Epimax are available and classified as GREEN)', '13 - Skin', 'DOUBLE_RED', 'double red'),
('Avipeptadil/Phentolamine intercavernosal injection (Invicorp)', '07 Obstetrics, gynaecology, urinary–tract disorder', 'SPECIALIST_INITIATED', 'Specialist Initiated'),
('Avodart (generic Dutasteride is green)', '06 - Endocrine system androgens', 'DOUBLE_RED', 'double red'),
('Azathioprine (Chronic bowel disorder)', '01 Gastro–intestinal system', 'SPECIALIST_INITIATED', 'amber 1'),
('Azathioprine (CNS)', '04 - Central nervous system', 'SPECIALIST_INITIATED', 'amber 1'),
('Azathioprine (Musculoskeletal)', '10 - Musculoskeletal and joint diseases', 'SPECIALIST_INITIATED', 'amber 1'),
('Azathioprine (Skin)', '13 - Skin', 'SPECIALIST_INITIATED', 'amber 1'),
('Azathioprine (Immunosuppression)', '08 - Malignant disease and immunosuppression', 'SPECIALIST_INITIATED', 'amber 1'),
('Azithromycin (for Bronchiectasis)', '03 - Respiratory system', 'SPECIALIST_RECOMMENDED', 'Specialist Recommended'),
('Baby milk for lactose intolerance eg SMA LF, Enfamil O-Lac, Aptamil LF (not routinely commissioned - IFR only)', '09 - Nutrition and blood', 'DOUBLE_RED', 'double red'),
('Baby milk ready made cartons', '09 - Nutrition and blood', 'DOUBLE_RED', 'double red'),
('Bapscarcare', '18 - Dressings', 'DOUBLE_RED', 'double red'),
('Bard Purewick', '19 - Appliances', 'DOUBLE_RED', 'double red'),
('Baricitinib', '10 - Musculoskeletal and joint diseases', 'RED', 'red'),
('Baricitinib for alopecia areata - IFR only', '13 - Skin', 'DOUBLE_RED', 'double red'),
('Basiliximab', '08 - Malignant disease and immunosuppression', 'RED', 'red'),
('Beclometasone dipropionate tablets (Clipper)', '01 - Gastro–intestinal system', 'RED', 'red'),
('Berinert', '03 - Respiratory system', 'RED', 'red'),
('Bevespi Aerosphere', '03 - Respiratory system', 'DOUBLE_RED', 'double red'),
('Bexarotene', '08 - Malignant disease and immunosuppression', 'RED', 'red'),
('Bicalutamide', '08 Malignant disease and immunosuppression', 'SPECIALIST_INITIATED', 'Specialist Initiated'),
('Bilastine (Ilaxten)', '03 - Respiratory system', 'SPECIALIST_RECOMMENDED', 'Specialist Recommended');

-- Create index for better search performance
CREATE INDEX idx_traffic_light_medicines_name ON public.traffic_light_medicines USING GIN(to_tsvector('english', name));
CREATE INDEX idx_traffic_light_medicines_status ON public.traffic_light_medicines(status_enum);
CREATE INDEX idx_traffic_light_medicines_bnf ON public.traffic_light_medicines(bnf_chapter);