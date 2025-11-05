-- Add logo columns to games table
ALTER TABLE games 
ADD COLUMN home_team_logo TEXT,
ADD COLUMN away_team_logo TEXT;