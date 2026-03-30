-- Add pdf_theme preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pdf_theme TEXT NOT NULL DEFAULT 'slate';

-- Valid values: 'slate' | 'navy' | 'forest'
COMMENT ON COLUMN profiles.pdf_theme IS 'PDF colour theme: slate (charcoal/white), navy (deep navy/gold), forest (green/cream)';
