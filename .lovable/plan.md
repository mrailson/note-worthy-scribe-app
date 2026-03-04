

## Plan: Bulk Add Staff to Attendees & Practice Staff List

### What We Know
- **Anita Carter's user_id**: `0f36cc1e-1a4d-43cb-a4d3-6e5a5e799ac0`
- **Brook Health Centre practice_id**: `ebb2bf2c-1d20-42d9-8572-ce07a4dae3de`
- **Already added as attendees**: Lesley Driscoll, Lisa Belch, Michele Cooper (+ "Carter")
- **Total individual staff in document**: ~33 people (excluding generic emails like Complaints, Arden & Gem, Prescriptions, Secretaries, BHC Generic, Safeguarding)
- **Already existing**: 3 match (Lesley Driscoll, Lisa Belch, Michele Cooper) — so ~30 new attendees to add
- **Anita Carter herself** should be excluded (she's the owner)

### What We'll Do

#### 1. Insert ~30 new attendees into the `attendees` table
Each record will have:
- `user_id`: Anita Carter's ID (she owns these attendee records)
- `practice_id`: Brook Health Centre's ID
- `name`: Staff member's full name
- `email`: Their NHS email
- `role`: "Admin Team" (as requested)
- `organization`: "The Brook Health Centre"
- `organization_type`: "practice"
- `is_default`: false

Staff to add (excluding Anita Carter, Lesley Driscoll, Lisa Belch, Michele Cooper):
Arif Supple, Samreen Arif, Clare Turner, Dayani Perera, Theresa Kirkland, Linda Davidsen, Jackie Bullivant, Adele Emerson, Sarah Mitchell, Tracy Marshall, Kerrie Mortimer, Katie Gray, Colleen Dennis, Hazel Smith, Isla Bridgwood, Wendy Green, Mandy Lowe, Jackie Palmer, Kim McKeown, Kate Key, Caroline Kirton, Jade Brown, Abby Samuel, Jane Green, Tina Mullis, Helen De Bono, Phoebe Johnson, Parul Ravalia, Bianca Pahontu, Dr P Stevens, Dr Afaq Malik, Tina Purnell, Rebecca Evans

#### 2. Insert ~33 staff into `practice_staff_defaults` table
This populates the practice's staff/team list. All entries with:
- `practice_id`: Brook Health Centre
- `staff_name`: Full name
- `default_email`: NHS email
- `staff_role`: "Admin Team"
- `is_active`: true

This includes all staff from the document (including those already in attendees, since practice_staff_defaults is a separate table and currently empty for this practice).

### Technical Details
- No code changes needed — this is purely data insertion using SQL
- No login accounts will be created
- The "Ask AI" (AI4GP) and "Meeting Manager" access note is acknowledged but since these are attendee records only (not user accounts), module access doesn't apply — module access requires a login account. The attendees will appear in the practice's attendee list and staff defaults for meeting/complaint workflows.

### Implementation
Two SQL insert statements executed via the database insert tool — one for the `attendees` table and one for `practice_staff_defaults`.

