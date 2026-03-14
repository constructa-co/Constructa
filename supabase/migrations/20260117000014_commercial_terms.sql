ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS exclusions TEXT DEFAULT '1. Hazardous waste removal.\n2. Decorating.',
ADD COLUMN IF NOT EXISTS clarifications TEXT DEFAULT '1. Water and electric to be provided by client.\n2. Access required Mon-Fri 8am-5pm.';
