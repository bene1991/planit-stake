-- Setup pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the cron job
SELECT cron.schedule(
    'live-robot-cron-job',
    '* * * * *',
    $$
    SELECT
        net.http_post(
            url:='https://zswefmaedkdvbzakuzod.supabase.co/functions/v1/live-robot-cron',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E"}'::jsonb,
            body:='{}'::jsonb
        ) AS request_id;
    $$
);
