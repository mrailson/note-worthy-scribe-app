-- Create traffic_light_vocab table for storing medicines data
CREATE TABLE public.traffic_light_vocab (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    medicine_name TEXT NOT NULL,
    status TEXT NOT NULL,
    bnf_chapter TEXT,
    last_modified DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_traffic_light_vocab_medicine_name ON public.traffic_light_vocab(medicine_name);
CREATE INDEX idx_traffic_light_vocab_status ON public.traffic_light_vocab(status);
CREATE INDEX idx_traffic_light_vocab_bnf_chapter ON public.traffic_light_vocab(bnf_chapter);

-- Enable Row Level Security
ALTER TABLE public.traffic_light_vocab ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read the medicines data (public reference data)
CREATE POLICY "Allow public read access to traffic light medicines" 
ON public.traffic_light_vocab 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_traffic_light_vocab_updated_at
    BEFORE UPDATE ON public.traffic_light_vocab
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();