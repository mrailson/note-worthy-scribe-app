-- Create NRES user settings table for rate persistence
CREATE TABLE public.nres_user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  hourly_rate DECIMAL(10,2),
  rate_set_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create NRES hours entries table
CREATE TABLE public.nres_hours_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(5,2) NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create NRES expenses table
CREATE TABLE public.nres_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  receipt_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.nres_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_hours_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for nres_user_settings
CREATE POLICY "Users can view their own settings"
  ON public.nres_user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON public.nres_user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.nres_user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for nres_hours_entries
CREATE POLICY "Users can view their own hours entries"
  ON public.nres_hours_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hours entries"
  ON public.nres_hours_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hours entries"
  ON public.nres_hours_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hours entries"
  ON public.nres_hours_entries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for nres_expenses
CREATE POLICY "Users can view their own expenses"
  ON public.nres_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses"
  ON public.nres_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON public.nres_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
  ON public.nres_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_nres_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_nres_user_settings_updated_at
  BEFORE UPDATE ON public.nres_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_nres_updated_at_column();

CREATE TRIGGER update_nres_hours_entries_updated_at
  BEFORE UPDATE ON public.nres_hours_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_nres_updated_at_column();

CREATE TRIGGER update_nres_expenses_updated_at
  BEFORE UPDATE ON public.nres_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_nres_updated_at_column();