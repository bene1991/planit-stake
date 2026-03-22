-- Migration: Schedule cron job for live-alerts-resolver-v3
-- Date: 2026-03-20

-- Create the cron job to run every 1 minute
-- Using the project ref zswefmaedkdvbzakuzod found in .temp/project-ref
SELECT cron.schedule(
    'live-alerts-resolver-v3-job',
    '* * * * *',
    $$
    SELECT
        net.http_post(
            url:='https://zswefmaedkdvbzakuzod.supabase.co/functions/v1/live-alerts-resolver-v3',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E"}'::jsonb,
            body:='{}'::jsonb
        ) AS request_id;
    $$
);
