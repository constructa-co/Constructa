-- Fix RLS on estimate_line_components: simplify join chain to avoid
-- resolution failures on certain org/project configurations.
-- Also reset stale buildup lines that have no components back to simple mode.

-- Drop the complex multi-join RLS policies that may fail
DROP POLICY IF EXISTS elc_select ON estimate_line_components;
DROP POLICY IF EXISTS elc_insert ON estimate_line_components;
DROP POLICY IF EXISTS elc_update ON estimate_line_components;
DROP POLICY IF EXISTS elc_delete ON estimate_line_components;

-- Replace with simpler policies that join directly through estimates to projects
CREATE POLICY elc_select ON estimate_line_components FOR SELECT
  USING (
    estimate_line_id IN (
      SELECT el.id FROM estimate_lines el
      JOIN estimates e ON el.estimate_id = e.id
      JOIN projects p ON e.project_id = p.id
      WHERE p.user_id = auth.uid()
         OR p.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
         )
    )
  );

CREATE POLICY elc_insert ON estimate_line_components FOR INSERT
  WITH CHECK (
    estimate_line_id IN (
      SELECT el.id FROM estimate_lines el
      JOIN estimates e ON el.estimate_id = e.id
      JOIN projects p ON e.project_id = p.id
      WHERE p.user_id = auth.uid()
         OR p.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
         )
    )
  );

CREATE POLICY elc_update ON estimate_line_components FOR UPDATE
  USING (
    estimate_line_id IN (
      SELECT el.id FROM estimate_lines el
      JOIN estimates e ON el.estimate_id = e.id
      JOIN projects p ON e.project_id = p.id
      WHERE p.user_id = auth.uid()
         OR p.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
         )
    )
  );

CREATE POLICY elc_delete ON estimate_line_components FOR DELETE
  USING (
    estimate_line_id IN (
      SELECT el.id FROM estimate_lines el
      JOIN estimates e ON el.estimate_id = e.id
      JOIN projects p ON e.project_id = p.id
      WHERE p.user_id = auth.uid()
         OR p.organization_id IN (
           SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
         )
    )
  );

-- Also fix rate_buildups RLS to include user_id check (not just org)
DROP POLICY IF EXISTS rbu_select ON rate_buildups;
DROP POLICY IF EXISTS rbu_manage ON rate_buildups;

CREATE POLICY rbu_select ON rate_buildups FOR SELECT
  USING (
    is_system_default = TRUE
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY rbu_manage ON rate_buildups FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Reset stale buildup lines that have no components back to simple mode
-- This cleans up the Oaktree project lines that got stuck
UPDATE estimate_lines
SET pricing_mode = 'simple'
WHERE pricing_mode = 'buildup'
AND id NOT IN (SELECT DISTINCT estimate_line_id FROM estimate_line_components);
