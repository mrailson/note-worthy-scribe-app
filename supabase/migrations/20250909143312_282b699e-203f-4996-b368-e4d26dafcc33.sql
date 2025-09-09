-- Create a timeout function to prevent race conditions
CREATE OR REPLACE FUNCTION delay_seconds(seconds integer)
RETURNS void AS $$
BEGIN
  PERFORM pg_sleep(seconds);
END;
$$ LANGUAGE plpgsql;

-- Create a new edge function to handle delayed note generation with better error handling
CREATE OR REPLACE FUNCTION trigger_delayed_notes_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple notification without complex logic to avoid deadlocks
  PERFORM pg_notify('meeting_completed', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;