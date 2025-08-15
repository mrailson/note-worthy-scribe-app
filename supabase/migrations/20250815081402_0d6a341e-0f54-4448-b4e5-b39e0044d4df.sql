-- Create function to get database table sizes
CREATE OR REPLACE FUNCTION get_database_table_sizes()
RETURNS TABLE(
  table_name text,
  size_bytes bigint,
  size_pretty text,
  row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename AS table_name,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size_pretty,
    n_tup_ins - n_tup_del AS row_count
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$;