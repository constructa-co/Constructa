CREATE TABLE IF NOT EXISTS estimate_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  successor_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  lag_days INTEGER DEFAULT 0,
  UNIQUE(predecessor_id, successor_id) -- Prevent duplicate links
);
