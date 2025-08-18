-- Create consultation history table for production persistence
CREATE TABLE public.consultation_history (
  id TEXT PRIMARY KEY,                 -- e.g. CONS-1717440000000
  user_id UUID REFERENCES auth.users(id) NOT NULL,  -- clinician
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  template TEXT NOT NULL,
  overview TEXT NOT NULL,
  status TEXT CHECK (status IN ('Recording','Generated')) NOT NULL DEFAULT 'Recording',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX consultation_history_user_idx ON public.consultation_history (user_id, updated_at DESC);

-- Enable RLS
ALTER TABLE public.consultation_history ENABLE ROW LEVEL SECURITY;

-- Create policies for consultation history
CREATE POLICY "Users can view their own consultation history" 
ON public.consultation_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consultation history" 
ON public.consultation_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consultation history" 
ON public.consultation_history 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consultation history" 
ON public.consultation_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_consultation_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_consultation_history_updated_at
BEFORE UPDATE ON public.consultation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_consultation_history_updated_at();