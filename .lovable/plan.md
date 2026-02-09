

# Update COMP260007: Correct Complaint Details

## What Happened

Record COMP260007 for James Robert Williams currently contains incorrect data about "Repeated appointment cancellations" at Oak Lane Practice. Based on your screenshot, it should be about an urgent ultrasound delay at The Brook Health Centre.

## Data Update

The following fields will be corrected:

| Field | Current (incorrect) | Corrected |
|---|---|---|
| Title | Repeated appointment cancellations and poor communication | Urgent ultrasound delay |
| Description | About cancelled appointments at Oak Lane Practice | About delay in receiving urgent ultrasound at The Brook Health Centre |
| Location/Service | Oak Lane Practice | The Brook Health Centre |
| Practice | Oak Lane Practice (c800c954...) | The Brook Health Centre (ebb2bf2c-1d20-42d9-8572-ce07a4dae3de) |
| Incident Date | 2025-08-01 | 2026-01-31 |

## Technical Detail

A single SQL UPDATE statement will be run against the `complaints` table targeting `reference_number = 'COMP260007'` to correct all five fields listed above. No schema or code changes are required.

