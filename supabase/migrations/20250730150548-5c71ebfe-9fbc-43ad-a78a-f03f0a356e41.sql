-- Create enum types for permissions and file types
CREATE TYPE public.permission_level AS ENUM ('owner', 'editor', 'viewer', 'no_access');
CREATE TYPE public.permission_action AS ENUM ('view', 'edit', 'delete', 'share', 'upload');
CREATE TYPE public.file_type AS ENUM ('folder', 'file');

-- Create storage bucket for shared drive files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shared-drive', 'shared-drive', false);

-- Create folders table
CREATE TABLE public.shared_drive_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.shared_drive_folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  path TEXT NOT NULL,
  UNIQUE(parent_id, name)
);

-- Create files table
CREATE TABLE public.shared_drive_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  folder_id UUID REFERENCES public.shared_drive_folders(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  mime_type TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  UNIQUE(folder_id, name)
);

-- Create permissions table
CREATE TABLE public.shared_drive_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id UUID NOT NULL,
  target_type file_type NOT NULL,
  user_id UUID NOT NULL,
  permission_level permission_level NOT NULL,
  actions permission_action[] NOT NULL DEFAULT '{}',
  is_inherited BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(target_id, target_type, user_id)
);

-- Create activity log table
CREATE TABLE public.shared_drive_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id UUID NOT NULL,
  target_type file_type NOT NULL,
  target_name TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);