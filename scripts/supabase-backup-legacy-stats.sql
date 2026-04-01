-- ============================================
-- Supabase 旧统计结构备份脚本
-- ============================================
-- 目的：
-- 1. 为旧表创建带时间戳的快照备份
-- 2. 备份旧视图定义，便于回滚
-- 3. 为后续删除旧结构提供安全前置条件
-- ============================================
-- 使用方式：
-- 1. 在 Supabase SQL Editor 中执行
-- 2. 记录 NOTICE 输出中的备份表名
-- 3. 确认备份成功后，再执行删视图/删旧表脚本
-- ============================================

DO $$
DECLARE
  snapshot_suffix TEXT := to_char(NOW() AT TIME ZONE 'Asia/Shanghai', 'YYYYMMDD_HH24MISS');
  backup_views_table TEXT := format('backup_wallpaper_views_%s', snapshot_suffix);
  backup_downloads_table TEXT := format('backup_wallpaper_downloads_%s', snapshot_suffix);
  backup_viewdefs_table TEXT := format('backup_legacy_view_definitions_%s', snapshot_suffix);
BEGIN
  IF to_regclass('public.wallpaper_views') IS NOT NULL THEN
    EXECUTE format(
      'CREATE TABLE public.%I (LIKE public.wallpaper_views INCLUDING ALL)',
      backup_views_table
    );
    -- 备份表不再继续依赖源表序列，避免后续 DROP 源表时被阻塞。
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT',
      backup_views_table
    );
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM public.wallpaper_views',
      backup_views_table
    );
    RAISE NOTICE 'Created table backup: public.%', backup_views_table;
  ELSE
    RAISE NOTICE 'Skipped table backup: public.wallpaper_views does not exist';
  END IF;

  IF to_regclass('public.wallpaper_downloads') IS NOT NULL THEN
    EXECUTE format(
      'CREATE TABLE public.%I (LIKE public.wallpaper_downloads INCLUDING ALL)',
      backup_downloads_table
    );
    -- 备份表不再继续依赖源表序列，避免后续 DROP 源表时被阻塞。
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT',
      backup_downloads_table
    );
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM public.wallpaper_downloads',
      backup_downloads_table
    );
    RAISE NOTICE 'Created table backup: public.%', backup_downloads_table;
  ELSE
    RAISE NOTICE 'Skipped table backup: public.wallpaper_downloads does not exist';
  END IF;

  EXECUTE format(
    'CREATE TABLE public.%I (
      view_name TEXT PRIMARY KEY,
      view_definition TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )',
    backup_viewdefs_table
  );

  EXECUTE format($sql$
    INSERT INTO public.%I (view_name, view_definition)
    SELECT
      table_name,
      pg_get_viewdef(to_regclass(format('public.%%I', table_name)), true)
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN (
        'view_stats',
        'download_stats',
        'popular_wallpapers',
        'popular_wallpapers_weekly',
        'popular_wallpapers_monthly'
      )
    ORDER BY table_name
  $sql$, backup_viewdefs_table);

  RAISE NOTICE 'Created view-definition backup: public.%', backup_viewdefs_table;
END $$;

-- 验证：列出本次备份产物
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'backup_wallpaper_views_%'
    OR tablename LIKE 'backup_wallpaper_downloads_%'
    OR tablename LIKE 'backup_legacy_view_definitions_%'
  )
ORDER BY tablename DESC;
