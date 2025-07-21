-- Create user settings table for GP Scribe preferences
CREATE TABLE public.gp_scribe_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  default_output_level INTEGER NOT NULL DEFAULT 3,
  default_show_snomed_codes BOOLEAN NOT NULL DEFAULT true,
  default_format_for_emis BOOLEAN NOT NULL DEFAULT true,
  default_format_for_systmone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.gp_scribe_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own GP Scribe settings" 
ON public.gp_scribe_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GP Scribe settings" 
ON public.gp_scribe_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GP Scribe settings" 
ON public.gp_scribe_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GP Scribe settings" 
ON public.gp_scribe_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_gp_scribe_settings_updated_at
BEFORE UPDATE ON public.gp_scribe_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();