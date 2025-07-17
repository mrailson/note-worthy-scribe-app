-- Create user profiles table for NHS staff
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  nhs_trust TEXT,
  department TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'general',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting transcripts table
CREATE TABLE public.meeting_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker_name TEXT,
  content TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting summaries table
CREATE TABLE public.meeting_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT[],
  action_items TEXT[],
  decisions TEXT[],
  next_steps TEXT[],
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Meetings RLS policies
CREATE POLICY "Users can view their own meetings" 
ON public.meetings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings" 
ON public.meetings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings" 
ON public.meetings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Meeting transcripts RLS policies
CREATE POLICY "Users can view transcripts of their meetings" 
ON public.meeting_transcripts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_transcripts.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can insert transcripts for their meetings" 
ON public.meeting_transcripts 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_transcripts.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can update transcripts of their meetings" 
ON public.meeting_transcripts 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_transcripts.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can delete transcripts of their meetings" 
ON public.meeting_transcripts 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_transcripts.meeting_id 
  AND meetings.user_id = auth.uid()
));

-- Meeting summaries RLS policies
CREATE POLICY "Users can view summaries of their meetings" 
ON public.meeting_summaries 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_summaries.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can insert summaries for their meetings" 
ON public.meeting_summaries 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_summaries.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can update summaries of their meetings" 
ON public.meeting_summaries 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_summaries.meeting_id 
  AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can delete summaries of their meetings" 
ON public.meeting_summaries 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE meetings.id = meeting_summaries.meeting_id 
  AND meetings.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_summaries_updated_at
  BEFORE UPDATE ON public.meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();