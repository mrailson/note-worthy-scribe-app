
# Plan: Enhanced Practice User Management for Practice Managers

## Overview

This plan enhances the Practice User Management interface to give Practice Managers full control over creating, editing, and deleting users within their practice. The key improvements include:

1. **Password field with validation** - Practice Managers can set a password (minimum 8 characters, at least 1 number)
2. **Email preview modal** - View the welcome email content before sending
3. **Expanded module toggles** - All requested services with on/off sliders
4. **Improved user flow** - Clear two-step process for user creation

---

## Module Toggles to Include

Based on your requirements, the following modules will have on/off toggles:

| Module | Display Name | Storage |
|--------|--------------|---------|
| `ai4gp_access` | Ask AI | `profiles` table |
| `meeting_notes_access` | Meeting Manager | `user_roles` table |
| `survey_manager_access` | Survey Tool | `user_roles` table |
| `policy_service` | Practice Policy Service | `user_service_activations` table |
| `complaints_manager_access` | Complaints Service | `user_roles` table |

Note: The Practice Policy Service uses the service activation pattern (like NRES) rather than a simple boolean flag.

---

## Implementation Steps

### Step 1: Update the User Creation Form

**File: `src/components/PracticeUserManagement.tsx`**

- Add a new password field with the following validation:
  - Minimum 8 characters
  - At least 1 number
  - Show/hide password toggle (Eye icon)
  - Real-time validation feedback
  
- Reorganise the module toggles section to display:
  - Ask AI (AI4GP)
  - Meeting Manager (Meeting Notes)
  - Survey Tool
  - Practice Policy Service
  - Complaints Service

- Add state for tracking Policy Service access (similar to NRES pattern)

### Step 2: Add Email Preview Modal

**File: `src/components/PracticeUserManagement.tsx`**

- Create a new `showEmailPreview` state
- Add a preview modal that displays:
  - Recipient email address
  - Subject line
  - Preview of email content (login URL, password setup link, enabled modules)
  - "Send Email" and "Cancel" buttons
  
- Flow change:
  1. User fills form and clicks "Create User"
  2. User is created in the database
  3. Email preview modal appears
  4. Practice Manager reviews and clicks "Send Email" to dispatch the welcome email

### Step 3: Update Edge Function for Password

**File: `supabase/functions/create-user-practice-manager/index.ts`**

- Accept optional `password` field in the request
- If password is provided, use it instead of auto-generating one
- Keep the auto-generation as fallback if no password is provided
- Add `policy_service_access` boolean to handle service activation during creation
- Add `survey_manager_access` to the module_access interface and database insert

### Step 4: Update Edge Function for Editing

**File: `supabase/functions/update-user-practice-manager/index.ts`**

- Add support for `survey_manager_access` in module updates
- Add logic to handle `policy_service_access` via service activations table (insert/delete pattern like NRES)

### Step 5: Update Welcome Email Function

**File: `supabase/functions/send-user-welcome-email/index.ts`**

- Add `survey_manager_access` to the ModuleAccess interface
- Add Survey Tool to the moduleInfo dictionary with appropriate label, description, and category
- Add Practice Policy Service to the module display

---

## Technical Details

### Password Validation (Client-side)
```text
Pattern: /^(?=.*\d).{8,}$/
- At least 8 characters
- At least 1 number
```

### Email Preview Modal Content
The preview will show:
- To: [user email]
- Subject: Welcome to GP Notewell AI - Your Account Details
- Body preview with:
  - Login URL
  - User name and role
  - Practice name
  - List of enabled modules
  - Password setup link information

### Policy Service Activation Pattern
```text
When toggling Policy Service access:
- ON: Insert row into user_service_activations with service='policy_service'
- OFF: Delete row from user_service_activations where user_id and service='policy_service'
```

---

## UI Changes Summary

### Add User Modal - New Elements:
1. **Password field** with:
   - Eye icon to toggle visibility
   - Validation message below (red if invalid)
   - Helper text: "Minimum 8 characters with at least 1 number"

2. **Module Access section** reorganised:
   - Ask AI
   - Meeting Manager
   - Survey Tool
   - Practice Policy Service
   - Complaints Service
   (Fridge Monitoring and NRES remain as they currently are)

3. **Email Preview toggle/modal** after user creation

### Email Preview Modal:
- Shows a styled preview of the welcome email
- "Send Email" button (primary)
- "Skip" button (if they don't want to send)

---

## Files to Modify

1. **`src/components/PracticeUserManagement.tsx`**
   - Add password field with validation
   - Add email preview modal
   - Expand module toggles
   - Add Policy Service activation handling

2. **`supabase/functions/create-user-practice-manager/index.ts`**
   - Accept custom password
   - Add survey_manager_access support
   - Add policy_service_access support via service activations

3. **`supabase/functions/update-user-practice-manager/index.ts`**
   - Add survey_manager_access support
   - Add policy_service_access support

4. **`supabase/functions/send-user-welcome-email/index.ts`**
   - Add Survey Manager to module info
   - Add Practice Policies to module info

---

## Security Considerations

- Password validation is enforced both client-side and server-side
- Practice Manager authorisation is verified before any operation
- Users can only manage staff within their own practice
- Practice Managers cannot elevate users to practice_manager or system_admin roles
- All module changes are logged in the database

