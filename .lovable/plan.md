

# Add Test Staff Members for All Practices

## What
Insert 2-3 realistic test staff members per practice across three categories (**GP Locum**, **New SDA**, **Buy-Back**) into the `nres_buyback_staff` table. Excludes Brackley & Towcester PCN and skips Management/Meeting categories as requested.

## Practices (7)
The Parks, Brackley, Springfield, Towcester, Bugbrooke, Brook, Denton

## Staff to insert (~56 records)

Each practice gets:
- **2-3 GP Locums** — allocation_type: `sessions` or `daily`, realistic Dr names
- **2-3 New SDA** — allocation_type: `sessions`, `wte`, or `hours`, clinical role names (ANP, Paramedic, Pharmacist)
- **2-3 Buy-Back** — allocation_type: `sessions` or `hours`, existing staff names

Example per practice:

| Name | Category | Role | Allocation | Value | Rate |
|------|----------|------|------------|-------|------|
| Dr James Hartley | gp_locum | GP Locum | sessions | 4 | 375 |
| Dr Priya Sharma | gp_locum | GP Locum | daily | 2 | 750 |
| Sarah Mitchell | new_sda | Advanced Nurse Practitioner | sessions | 6 | 0 |
| Tom Bradley | new_sda | Clinical Pharmacist | wte | 0.6 | 0 |
| Dr Helen Cross | buyback | Salaried GP | sessions | 3 | 0 |
| Karen Booth | buyback | Practice Nurse | hours | 12 | 28 |

## Technical approach

1. Create a migration SQL file that inserts all ~56 staff records into `nres_buyback_staff`
2. Use a fixed user_id from an admin user (or the current auth user via a function)
3. Set `is_active = true`, `start_date = '2026-01-06'` for all
4. Practice keys: parks, brackley, springfield, towcester, bugbrooke, brook, denton

## Names (realistic British/diverse mix)
GP Locums: Dr James Hartley, Dr Priya Sharma, Dr Liam O'Brien, Dr Fatima Khan, Dr George Whitfield, Dr Ananya Patel, Dr Robert Jennings, Dr Mei-Lin Chen, Dr Thomas Ashworth, Dr Sobia Hussain, Dr William Denton, Dr Kavita Rao, Dr Andrew Blackwell, Dr Nadia Khoury, Dr Christopher Hale

New SDA: Sarah Mitchell (ANP), Tom Bradley (Clinical Pharmacist), Emma Richardson (Paramedic Practitioner), Aisha Begum (Physician Associate), David Thornton (Mental Health Practitioner), Rachel Hughes (Dietitian), James Okonkwo (Social Prescriber), etc.

Buy-Back: Dr Helen Cross, Karen Booth, Lisa Greenwood, Michael Parsons, Dr Susan Whitmore, Angela Foster, etc.

