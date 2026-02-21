
-- Create stock_images table
CREATE TABLE public.stock_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_images ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active stock images
CREATE POLICY "Authenticated users can view active stock images"
ON public.stock_images
FOR SELECT
TO authenticated
USING (is_active = true);

-- System admins can view all stock images (including inactive)
CREATE POLICY "Admins can view all stock images"
ON public.stock_images
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));

-- System admins can insert stock images
CREATE POLICY "Admins can insert stock images"
ON public.stock_images
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- System admins can update stock images
CREATE POLICY "Admins can update stock images"
ON public.stock_images
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));

-- System admins can delete stock images
CREATE POLICY "Admins can delete stock images"
ON public.stock_images
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'));

-- Create public storage bucket for stock images
INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-images', 'stock-images', true);

-- Anyone can view stock images (public bucket)
CREATE POLICY "Public read access for stock images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'stock-images');

-- System admins can upload stock images
CREATE POLICY "Admins can upload stock images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stock-images' AND public.has_role(auth.uid(), 'system_admin'));

-- System admins can update stock images in storage
CREATE POLICY "Admins can update stock images in storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'stock-images' AND public.has_role(auth.uid(), 'system_admin'));

-- System admins can delete stock images from storage
CREATE POLICY "Admins can delete stock images from storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'stock-images' AND public.has_role(auth.uid(), 'system_admin'));

-- Index for category filtering
CREATE INDEX idx_stock_images_category ON public.stock_images (category);

-- GIN index for tag searching
CREATE INDEX idx_stock_images_tags ON public.stock_images USING GIN (tags);
