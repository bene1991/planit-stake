ALTER TABLE methods ADD COLUMN sort_order integer DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at) as rn
  FROM methods
)
UPDATE methods SET sort_order = ordered.rn FROM ordered WHERE methods.id = ordered.id;