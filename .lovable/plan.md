
# Plan: Create Global AI Chat Purge Function

## Overview

Create a new edge function `purge-old-ai-chats` that allows system admins to delete all `ai_4_pm_searches` entries older than a specified number of days (default: 30) across all users, respecting the `is_protected` flag.

## What Gets Deleted

- **Target Table**: `public.ai_4_pm_searches` (Ask AI chat history)
- **Criteria**: Entries where `created_at` is older than 30 days AND `is_protected` is false
- **Preserved**: Any entry marked as "Protected" (Super Saved) will NOT be deleted

## What Is NOT Affected

- Meeting Notes (`meeting_notes_multi`) – no relationship
- Genie Consultations (`consultation_notes`) – no relationship
- Scribe Records – no relationship
- Any other clinical data – completely isolated

## Implementation

### New Edge Function: `supabase/functions/purge-old-ai-chats/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Check if user has system_admin role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const isSystemAdmin = userRoles?.some(r => r.role === 'system_admin')
    if (!isSystemAdmin) {
      throw new Error('Unauthorized: System admin access required')
    }

    // Parse request body for days threshold (default 30)
    let daysOld = 30
    let dryRun = false
    try {
      const body = await req.json()
      if (body.daysOld && typeof body.daysOld === 'number' && body.daysOld > 0) {
        daysOld = body.daysOld
      }
      if (body.dryRun === true) {
        dryRun = true
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    console.log(`Purging AI chats older than ${daysOld} days (cutoff: ${cutoffDate.toISOString()})`)

    // First get count and summary of chats to delete
    const { data: chatsToDelete, error: fetchError } = await supabase
      .from('ai_4_pm_searches')
      .select('id, title, user_id, created_at')
      .eq('is_protected', false)
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) throw fetchError

    if (!chatsToDelete || chatsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          dryRun,
          message: `No unprotected chats older than ${daysOld} days found`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by user for reporting
    const userCounts: Record<string, number> = {}
    chatsToDelete.forEach(chat => {
      userCounts[chat.user_id] = (userCounts[chat.user_id] || 0) + 1
    })

    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true,
          dryRun: true,
          wouldDelete: chatsToDelete.length,
          affectedUsers: Object.keys(userCounts).length,
          userBreakdown: userCounts,
          oldestChat: chatsToDelete[chatsToDelete.length - 1]?.created_at,
          newestChat: chatsToDelete[0]?.created_at,
          message: `Would delete ${chatsToDelete.length} chats from ${Object.keys(userCounts).length} users`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actually delete
    const chatIds = chatsToDelete.map(c => c.id)
    const { error } = await supabase
      .from('ai_4_pm_searches')
      .delete()
      .in('id', chatIds)

    if (error) throw error

    // Log the cleanup in audit log
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'ai_4_pm_searches',
        operation: 'BULK_PURGE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: chatsToDelete.length,
          days_old: daysOld,
          cutoff_date: cutoffDate.toISOString(),
          affected_users: Object.keys(userCounts).length,
          action: 'purge_old_ai_chats'
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount: chatsToDelete.length,
        affectedUsers: Object.keys(userCounts).length,
        userBreakdown: userCounts,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
        message: `Successfully deleted ${chatsToDelete.length} old AI chats from ${Object.keys(userCounts).length} users`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Purge old AI chats error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to purge old AI chats'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### Update Config: `supabase/config.toml`

Add entry for the new function:
```toml
[functions.purge-old-ai-chats]
verify_jwt = false
```

## Usage

### Dry Run (Preview What Would Be Deleted)
```bash
POST /functions/v1/purge-old-ai-chats
Authorization: Bearer <admin_token>
Body: { "dryRun": true, "daysOld": 30 }
```

### Actual Purge
```bash
POST /functions/v1/purge-old-ai-chats
Authorization: Bearer <admin_token>
Body: { "daysOld": 30 }
```

## Response Examples

### Dry Run Response
```json
{
  "success": true,
  "dryRun": true,
  "wouldDelete": 20,
  "affectedUsers": 1,
  "userBreakdown": { "user-uuid-1": 20 },
  "message": "Would delete 20 chats from 1 users"
}
```

### Actual Purge Response
```json
{
  "success": true,
  "deletedCount": 20,
  "affectedUsers": 1,
  "daysOld": 30,
  "message": "Successfully deleted 20 old AI chats from 1 users"
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/purge-old-ai-chats/index.ts` | Create new edge function |
| `supabase/config.toml` | Add function configuration |

## Security

- Requires valid authentication token
- Verifies user has `system_admin` role before allowing purge
- Logs all purge operations to `system_audit_log`
- Respects `is_protected` flag (Super Saved chats are never deleted)
