-- ============================================
-- Supabase 旧统计表删除脚本
-- ============================================
-- 说明：
-- 1. 仅在确认当前仓库与线上环境都已不再依赖旧表后执行
-- 2. 本脚本会强制检查备份是否存在
-- 3. 本脚本会强制检查旧视图是否已先删除
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.wallpaper_views') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename LIKE 'backup_wallpaper_views_%'
     ) THEN
    RAISE EXCEPTION
      'Refusing to drop public.wallpaper_views: no backup table matching public.backup_wallpaper_views_%% was found.';
  END IF;

  IF to_regclass('public.wallpaper_downloads') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename LIKE 'backup_wallpaper_downloads_%'
     ) THEN
    RAISE EXCEPTION
      'Refusing to drop public.wallpaper_downloads: no backup table matching public.backup_wallpaper_downloads_%% was found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN (
        'view_stats',
        'download_stats',
        'popular_wallpapers',
        'popular_wallpapers_weekly',
        'popular_wallpapers_monthly'
      )
  ) THEN
    RAISE EXCEPTION
      'Refusing to drop legacy tables: legacy views still exist. Run scripts/supabase-drop-legacy-views.sql first.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.wallpaper_stats_summary;
DROP TABLE IF EXISTS public.wallpaper_downloads;
DROP TABLE IF EXISTS public.wallpaper_views;

-- 验证：确认旧表已经不在 public schema 中
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'wallpaper_stats_summary',
    'wallpaper_downloads',
    'wallpaper_views'
  )
ORDER BY tablename;
