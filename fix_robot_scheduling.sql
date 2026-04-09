-- 1. DESATIVAR O ROBÔ ANTIGO (GHOST)
SELECT cron.unschedule('live-robot-cron-job');

-- 2. ATIVAR O ROBÔ OFICIAL (V4)
SELECT cron.schedule(
    'live-robot-cron-v3-job',
    '* * * * *',
    $$
    SELECT
        net.http_post(
            url:='https://zswefmaedkdvbzakuzod.supabase.co/functions/v1/live-robot-cron-v3',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E"}'::jsonb,
            body:='{}'::jsonb
        ) AS request_id;
    $$
);
