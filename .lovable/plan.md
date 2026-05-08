## Remove Mandatory Reads feature

Tear down everything added for the Mandatory Reads module so you can rebuild it differently.

### Frontend
- Delete `src/pages/MandatoryReads.tsx`
- Delete `src/pages/MandatoryReadView.tsx`
- Remove the `/mandatory-reads` and `/mandatory-reads/:id` routes (and imports) from `src/App.tsx`
- Remove any nav menu entry that points to Mandatory Reads (if present)

### Edge functions
Delete and undeploy:
- `mandatory-reads-publish`
- `mandatory-reads-acknowledge`
- `mandatory-reads-reminder-cron`
- `mandatory-reads-token-resolve`

### Database (migration)
- Unschedule the `pg_cron` job for the reminder cron
- Drop function `public.mark_mandatory_read_overdue()`
- Drop tables (CASCADE):
  - `mandatory_read_reminder_log`
  - `mandatory_read_acknowledgements`
  - `mandatory_read_assignments`
  - `mandatory_reads`

### Plan doc
- Clear the Mandatory Reads section from `.lovable/plan.md`

After approval I'll run the migration first, then remove the code and edge functions.