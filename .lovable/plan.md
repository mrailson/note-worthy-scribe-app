
# Fix AuthContext Polling Memory Leak

## Problem Identified
The `AuthContext.tsx` file contains a 30-second polling interval (lines 238-253) that continuously fetches:
- User modules (`fetchUserModules`)
- System admin status (`checkSystemAdmin`)  
- Consultation examples visibility (`checkConsultationExamplesVisibility`)

This runs every 30 seconds while the user is logged in, causing excessive memory usage and network requests that accumulate over time.

## Solution
Replace the aggressive polling with an **event-driven approach**:

1. **Remove the 30-second polling interval entirely** - These values rarely change during a session
2. **Keep the initial fetch on login** - Data is fetched once when the user authenticates
3. **Keep the `refreshUserModules` function** - Components can manually trigger a refresh if needed (e.g., after role changes in admin panel)
4. **Retain the 5-minute session activity update** - This is reasonable and already exists for session tracking

## Technical Details

### File: `src/contexts/AuthContext.tsx`

**Before (lines 237-253):**
```typescript
// Periodically refresh user modules and admin status (reduced frequency)
useEffect(() => {
  if (user?.id) {
    // Immediate refresh
    fetchUserModules(user.id);
    checkSystemAdmin(user.id);
    checkConsultationExamplesVisibility();
    
    const interval = setInterval(() => {
      fetchUserModules(user.id);
      checkSystemAdmin(user.id);
      checkConsultationExamplesVisibility();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }
}, [user?.id]);
```

**After:**
```typescript
// Fetch user modules and admin status once when user changes
// No polling - data is fetched on login and can be manually refreshed via refreshUserModules()
useEffect(() => {
  if (user?.id) {
    fetchUserModules(user.id);
    checkSystemAdmin(user.id);
    checkConsultationExamplesVisibility();
  }
}, [user?.id]);
```

## Impact
- **Memory**: Eliminates ~120 database queries per hour (3 queries × 2 per minute × 60 minutes)
- **Network**: Significantly reduces bandwidth and Supabase connection overhead
- **Performance**: Prevents memory accumulation from query results and React state updates
- **Behaviour**: User modules/admin status are still fetched on login; manual refresh available when needed

## Risk Assessment
- **Low risk**: User permissions rarely change during an active session
- **Fallback**: The `refreshUserModules` function remains available for explicit refreshes (e.g., after an admin updates roles)
- **Session activity tracking**: The separate 5-minute interval for session activity is unaffected and appropriate for its purpose
