-- Add api_fixture_id column to games table to link with API-Football
ALTER TABLE games ADD COLUMN api_fixture_id text;

-- Add index for faster lookups
CREATE INDEX idx_games_api_fixture_id ON games(api_fixture_id);
