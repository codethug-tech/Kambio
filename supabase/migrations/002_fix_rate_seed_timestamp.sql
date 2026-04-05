-- Fix existing placeholder rows: reset updated_at to epoch so the
-- backend staleness check immediately triggers a live BCV fetch.
UPDATE public.exchange_rates
SET updated_at = '1970-01-01T00:00:00Z'
WHERE rate = 0;
