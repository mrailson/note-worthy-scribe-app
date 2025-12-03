-- Add lg_capture to the service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'lg_capture';