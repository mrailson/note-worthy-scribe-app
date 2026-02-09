UPDATE complaints
SET complaint_title = 'Urgent ultrasound delay',
    complaint_description = 'Patient reports a significant delay in receiving an urgent ultrasound at The Brook Health Centre. The referral was made but the appointment was not scheduled in a timely manner, causing distress and concern about the delay in diagnosis.',
    location_service = 'The Brook Health Centre',
    practice_id = 'ebb2bf2c-1d20-42d9-8572-ce07a4dae3de',
    incident_date = '2026-01-31',
    updated_at = now()
WHERE reference_number = 'COMP260007';