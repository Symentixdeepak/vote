CREATE TABLE IF NOT EXISTS monitor_votes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  candidate TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS monitor_votes_roll_number_unique_idx
ON monitor_votes (lower(roll_number));
