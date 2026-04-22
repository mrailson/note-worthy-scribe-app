-- Backfill query_responded_at for claims that have a query_response but missing timestamp
UPDATE nres_buyback_claims
SET query_responded_at = submitted_at
WHERE query_response IS NOT NULL AND query_responded_at IS NULL;