-- Add columns to track audio chunk file sizes (original and optimised)
ALTER TABLE public.audio_chunks 
ADD COLUMN IF NOT EXISTS original_file_size integer,
ADD COLUMN IF NOT EXISTS transcoded_file_size integer,
ADD COLUMN IF NOT EXISTS compression_ratio numeric(5,2);

-- Add comment for documentation
COMMENT ON COLUMN public.audio_chunks.original_file_size IS 'Original audio chunk size in bytes before transcoding';
COMMENT ON COLUMN public.audio_chunks.transcoded_file_size IS 'Transcoded audio chunk size in bytes (16kHz mono WAV)';
COMMENT ON COLUMN public.audio_chunks.compression_ratio IS 'Compression ratio achieved (1 - transcoded/original)';