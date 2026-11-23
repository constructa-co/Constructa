-- D101 drill: deterministic schema snapshot of everything the two #176
-- migrations may touch. Printed with psql -At; compared byte for byte.
SELECT 'column|' || table_name || '|' || column_name || '|' || data_type || '|'
       || is_nullable || '|' || COALESCE(column_default, '<none>')
  FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'markup_method'
 ORDER BY table_name;

SELECT 'constraint|' || conrelid::regclass::text || '|' || conname || '|' || pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname LIKE '%markup_method%'
 ORDER BY conrelid::regclass::text, conname;

SELECT 'function|owner=' || pg_get_userbyid(p.proowner) || '|secdef=' || p.prosecdef
       || '|config=' || COALESCE(p.proconfig::text, '<none>')
       || '|acl=' || COALESCE(p.proacl::text, '<none>')
       || '|bodymd5=' || md5(p.prosrc)
  FROM pg_proc p
 WHERE p.oid = 'public.create_phase1_project_graph(uuid,jsonb,jsonb)'::regprocedure;

SELECT pg_get_functiondef('public.create_phase1_project_graph(uuid,jsonb,jsonb)'::regprocedure);
