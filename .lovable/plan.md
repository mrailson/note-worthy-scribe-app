
# Practice Manager Responsibility Tracker Service

## Overview
Create a comprehensive task and responsibility tracking system for Practice Managers. This service will allow:
1. Definition of recurring responsibilities (from the uploaded document and user-specified tasks)
2. Assignment of responsibilities to specific staff members or roles
3. Setting frequencies and due dates
4. Practice-wide calendar view showing all tasks across roles
5. Drill-down capability by role/person

## Data Model

### Database Tables

**1. `pm_responsibility_categories`** - Categories for grouping responsibilities
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Category name (e.g., HR, IT, Contracts/Quality, Facilities) |
| description | text | Optional description |
| practice_id | uuid | FK to gp_practices |
| created_at | timestamp | Creation timestamp |

**2. `pm_responsibilities`** - Master list of responsibilities
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| practice_id | uuid | FK to gp_practices |
| category_id | uuid | FK to pm_responsibility_categories |
| title | text | Responsibility title |
| description | text | Detailed description |
| frequency_type | text | annual, monthly, quarterly, weekly, one-off, custom |
| frequency_value | integer | For custom (e.g., every X months) |
| typical_due_month | integer | Month number for annual tasks (1-12) |
| typical_due_day | integer | Day of month if applicable |
| is_mandatory | boolean | Whether this is a mandatory task |
| reference_url | text | Link to guidance/documentation |
| created_by | uuid | User who created |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update |
| is_active | boolean | Soft delete flag |

**3. `pm_responsibility_assignments`** - Who is responsible for what
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| responsibility_id | uuid | FK to pm_responsibilities |
| assigned_to_user_id | uuid | FK to profiles (optional) |
| assigned_to_role | text | Practice role if not specific user |
| assigned_by | uuid | User who made assignment |
| notes | text | Assignment notes |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update |

**4. `pm_responsibility_instances`** - Specific occurrences/due dates
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| responsibility_id | uuid | FK to pm_responsibilities |
| assignment_id | uuid | FK to pm_responsibility_assignments |
| due_date | date | When this instance is due |
| completed_at | timestamp | When completed (null if pending) |
| completed_by | uuid | User who completed |
| status | text | pending, in_progress, completed, overdue, not_applicable |
| evidence_notes | text | Notes/evidence of completion |
| evidence_url | text | Link to evidence document |
| reminder_sent | boolean | Whether reminder was sent |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update |

### RLS Policies
- Users can only access data for their own practice
- Practice managers can manage all responsibilities for their practice
- Regular users can view and update their assigned responsibilities

## Components Structure

```text
src/
├── pages/
│   └── PracticeResponsibilityTracker.tsx          # Main page
├── components/
│   └── responsibility-tracker/
│       ├── ResponsibilityTrackerDashboard.tsx     # Main dashboard with tabs
│       ├── ResponsibilityList.tsx                 # List of all responsibilities
│       ├── ResponsibilityForm.tsx                 # Add/edit responsibility form
│       ├── AssignmentForm.tsx                     # Assign responsibility to user/role
│       ├── ResponsibilityInstanceCard.tsx         # Individual task card
│       ├── PracticeCalendarView.tsx               # Full practice calendar
│       ├── RoleFilteredView.tsx                   # View filtered by role
│       ├── UpcomingTasksPanel.tsx                 # Panel showing upcoming tasks
│       ├── OverdueTasksAlert.tsx                  # Alert for overdue items
│       ├── CategoryManager.tsx                    # Manage categories
│       └── BulkImportModal.tsx                    # Import from template
├── hooks/
│   ├── useResponsibilities.ts                     # CRUD for responsibilities
│   ├── useResponsibilityAssignments.ts            # Assignment management
│   └── useResponsibilityInstances.ts              # Instance tracking
└── types/
    └── responsibilityTypes.ts                     # TypeScript interfaces
```

## Features

### 1. Responsibility Management
- Add new responsibilities with title, description, category, frequency
- Pre-populated template from uploaded document categories:
  - **HR**: Pension forms, appraisals, payroll, DBS checks, etc.
  - **Contracts/Quality**: QOF, CQRS, complaints, CQC compliance
  - **IT/Facilities**: DSP Toolkit, IG training, H&S inspections
- Edit and archive responsibilities
- Set frequency (annual, monthly, quarterly, weekly, one-off, custom)

### 2. Assignment Form
Form fields:
- Select responsibility from dropdown
- Assign to specific user OR role
- Set start date and custom due date (if different from default)
- Add assignment notes
- Optional: Set up recurring instances automatically

### 3. Practice Calendar View
- Monthly calendar showing all tasks across the practice
- Colour-coded by:
  - Category (HR = blue, IT = green, Quality = purple, etc.)
  - Status (completed = green tick, pending = amber, overdue = red)
- Click to drill down to specific task
- Filter controls for role/person/category

### 4. Role/Person Drill-Down
- Select a role (e.g., "Practice Manager", "Nurse Manager", "IT Lead")
- See all responsibilities assigned to that role
- View calendar specific to that role
- Export to PDF/print for role handbooks

### 5. Pre-populated Tasks (from user request)
The following will be included as default templates:
| Task | Frequency | Typical Due |
|------|-----------|-------------|
| Type 2 Pension Forms | Annual | February |
| EDEC Submission | Annual | November/December |
| KOB14 Complaints Submission | Annual | October |
| IT Governance Training (DSP Toolkit) | Annual | Configurable |
| CQRS Declaration | Periodic | Configurable |
| QoF Achievement Check (clinic system) | Annual | 31st March |

### 6. Dashboard Summary
- Total responsibilities defined
- Tasks due this month/week
- Overdue tasks count (with red alert)
- Completion rate percentage
- Recent activity log

## Technical Implementation

### Route
```typescript
<Route path="/practice-responsibilities" element={
  <ProtectedRoute requiredModule="practice_manager_access">
    <PracticeResponsibilityTracker />
  </ProtectedRoute>
} />
```

### Page Structure
The main page will use tabs:
1. **Dashboard** - Summary cards, upcoming tasks, overdue alerts
2. **All Responsibilities** - Master list with search/filter
3. **Calendar** - Practice-wide calendar view
4. **By Role** - Drill-down view by role
5. **Settings** - Categories, templates, bulk import

### Database Migration
Single migration to create all four tables with:
- Appropriate foreign keys
- RLS policies scoped to practice
- Indexes for common queries (practice_id, due_date, status)

### Hooks Pattern
Following the existing `useNRESHoursTracker` pattern:
- Fetch data on mount
- CRUD operations with toast notifications
- Loading/saving states
- Optimistic updates where appropriate

## Navigation Integration
Add link to the Practice Manager menu/header navigation under "Practice Admin" section.

## Implementation Order
1. Database migration (4 tables + RLS)
2. TypeScript types
3. Core hooks (responsibilities, assignments, instances)
4. Main page with dashboard tab
5. Responsibility form and list
6. Assignment form
7. Calendar view component
8. Role filter view
9. Pre-populate default templates
10. Navigation integration
