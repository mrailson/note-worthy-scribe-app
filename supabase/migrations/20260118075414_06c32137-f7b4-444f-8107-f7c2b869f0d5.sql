-- Insert transcription audio format setting
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'transcription_audio_format',
  '{"format": "wav", "mp3_bitrate": 64}',
  'Audio format for transcription chunks. Options: wav, mp3 with bitrates 16/32/64/128 kbps. MP3 reduces file size significantly.'
)
ON CONFLICT (setting_key) DO NOTHING;