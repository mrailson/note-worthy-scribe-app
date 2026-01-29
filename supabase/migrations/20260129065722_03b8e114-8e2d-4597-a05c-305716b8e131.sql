-- Session tokens for AI chat capture
CREATE TABLE public.ai_chat_capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Captured images
CREATE TABLE public.ai_chat_captured_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_capture_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.ai_chat_capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_captured_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_capture_sessions
CREATE POLICY "Users can view own capture sessions"
  ON public.ai_chat_capture_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create capture sessions"
  ON public.ai_chat_capture_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own capture sessions"
  ON public.ai_chat_capture_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for ai_chat_captured_images
CREATE POLICY "Users can view own captured images"
  ON public.ai_chat_captured_images FOR SELECT
  USING (session_id IN (
    SELECT id FROM public.ai_chat_capture_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own captured images"
  ON public.ai_chat_captured_images FOR DELETE
  USING (session_id IN (
    SELECT id FROM public.ai_chat_capture_sessions WHERE user_id = auth.uid()
  ));

-- Service role policy for edge function inserts (no auth check needed for service role)
CREATE POLICY "Service role can insert captured images"
  ON public.ai_chat_captured_images FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for AI chat captured images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-chat-captures', 'ai-chat-captures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ai-chat-captures bucket
CREATE POLICY "Anyone can view ai-chat-captures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ai-chat-captures');

CREATE POLICY "Authenticated users can upload ai-chat-captures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ai-chat-captures');

CREATE POLICY "Users can delete own ai-chat-captures"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ai-chat-captures');