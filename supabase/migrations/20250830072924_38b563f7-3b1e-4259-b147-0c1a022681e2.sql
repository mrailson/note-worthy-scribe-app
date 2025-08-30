-- Update transcriber thresholds for better transcription acceptance
UPDATE user_settings 
SET setting_value = jsonb_set(
    jsonb_set(setting_value, '{transcriberThresholds,whisper}', '0.30'),
    '{transcriberThresholds,deepgram}', '0.30'
)
WHERE setting_key = 'meeting_transcriber_preferences' 
AND user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a';