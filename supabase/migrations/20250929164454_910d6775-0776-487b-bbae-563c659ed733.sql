-- Allow public access to read fridge details for QR code scanning
CREATE POLICY "Public can view fridge details for QR scanning" 
ON public.practice_fridges 
FOR SELECT 
USING (true);

-- Allow public to insert temperature readings
CREATE POLICY "Public can record temperature readings" 
ON public.fridge_temperature_readings 
FOR INSERT 
WITH CHECK (true);

-- Allow public to read temperature alerts (for display purposes)
CREATE POLICY "Public can view temperature alerts for readings" 
ON public.fridge_temperature_alerts 
FOR SELECT 
USING (true);