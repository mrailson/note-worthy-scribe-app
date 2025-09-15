# Meeting Auto-Close Service

## Overview

The Meeting Auto-Close Service automatically ends meeting recordings that have been inactive for 5+ minutes without new transcriptions and are not manually paused. This prevents meetings from staying in "recording" status for hours after the actual meeting has ended.

## How It Works

### 1. Background Monitoring
- The service runs automatically every 5 minutes on the main meeting page
- It checks all meetings with status "recording" and `is_paused = false`
- Only affects meetings that are at least 5 minutes old to avoid closing brand new meetings

### 2. Activity Detection
The service checks for recent activity in multiple transcript tables:
- `meeting_transcription_chunks` (primary)
- `meeting_transcripts` (legacy)  
- `transcription_chunks` (legacy)
- Meeting `updated_at` timestamp (user interaction)

### 3. Auto-Close Process
For meetings with no activity in the last 5 minutes:
1. Updates meeting status to "completed"
2. Sets `end_time` to current timestamp
3. Sets `notes_generation_status` to "queued"
4. Triggers notes generation if transcript content exists
5. Logs the auto-closure in the audit log

## Components

### Edge Function: `auto-close-inactive-meetings`
- **Location**: `supabase/functions/auto-close-inactive-meetings/index.ts`
- **Purpose**: Main service logic for detecting and closing inactive meetings
- **Security**: Uses service role key for database access
- **Returns**: Statistics on meetings checked and closed

### React Hook: `useMeetingAutoClose`
- **Location**: `src/hooks/useMeetingAutoClose.ts`
- **Purpose**: Client-side hook that runs the service periodically
- **Features**: 
  - Configurable interval (default: 5 minutes)
  - Can be enabled/disabled
  - Manual trigger function
  - Runs only when user is authenticated

### Admin Controls: `AdminMeetingControls`
- **Location**: `src/components/AdminMeetingControls.tsx`
- **Purpose**: System admin interface for manual triggers and monitoring
- **Features**:
  - Manual trigger button
  - Last run results display
  - Meeting statistics
  - Admin-only visibility

## Configuration

### Client-Side Hook Usage
```typescript
// In your main meeting page component
import { useMeetingAutoClose } from '@/hooks/useMeetingAutoClose';

// Enable with default 5-minute interval
useMeetingAutoClose({ enabled: !!user, intervalMinutes: 5 });

// Manual trigger (for admin controls)
const { triggerAutoClose } = useMeetingAutoClose();
```

### Edge Function Environment
Requires these Supabase environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Security Features

1. **Service Role Access**: Uses Supabase service role for database operations
2. **Admin Controls**: Manual triggers only available to system administrators
3. **Audit Logging**: All auto-closures are logged with details
4. **Safe Guards**: 
   - Only affects meetings in "recording" status
   - Respects manual pause settings
   - Minimum 5-minute meeting age requirement

## Monitoring

### Admin Dashboard
System administrators can:
- View auto-close service status
- Manually trigger the service
- See statistics on last run (meetings checked/closed)
- View closed meeting IDs

### Logs
Auto-closures are logged in:
- `system_audit_log` table with operation type "AUTO_CLOSE_INACTIVE"
- Edge function logs (accessible via Supabase dashboard)
- Client console logs (when running)

## Benefits

1. **Resource Management**: Prevents meetings from consuming resources indefinitely
2. **Data Integrity**: Ensures meeting statuses accurately reflect reality  
3. **User Experience**: Automatic cleanup without manual intervention
4. **System Health**: Reduces stuck meetings and improves system reliability

## Troubleshooting

### Common Issues

1. **Service Not Running**
   - Check if user is authenticated (service only runs for logged-in users)
   - Verify `useMeetingAutoClose` hook is imported and used
   - Check browser console for error logs

2. **Meetings Not Closing**
   - Verify meetings are truly inactive (no transcript activity in 5+ minutes)
   - Check if meetings are manually paused (`is_paused = true`)
   - Ensure meetings are at least 5 minutes old
   - Use admin controls to manually trigger and check results

3. **Edge Function Errors**
   - Check Supabase function logs for detailed error messages
   - Verify environment variables are set correctly
   - Check database permissions for service role

### Manual Verification
System admins can use the admin controls in System Admin > System Monitoring to:
- Manually trigger the auto-close check
- View detailed results and statistics
- Monitor service health and performance

## Implementation Details

### Activity Check Logic
```sql
-- Checks for recent transcript chunks (last 5 minutes)
SELECT created_at FROM meeting_transcription_chunks 
WHERE meeting_id = ? 
AND created_at >= (NOW() - INTERVAL '5 minutes')
ORDER BY created_at DESC LIMIT 1;
```

### Auto-Close Update
```sql
UPDATE meetings SET 
  status = 'completed',
  end_time = NOW(),
  updated_at = NOW(),
  notes_generation_status = 'queued'
WHERE id = ? AND status = 'recording' AND is_paused = false;
```

This service ensures that meeting recordings are automatically managed without manual intervention, improving system reliability and user experience.