-- ============================================
-- Supabase 旧统计视图删除脚本
-- ============================================
-- 说明：
-- 1. 对当前 wallpaper-gallery 仓库是安全的
-- 2. 可能影响仍在使用旧 REST 视图接口的历史客户端 / 外部脚本
-- 3. 建议先执行备份脚本，再执行本脚本
-- ============================================

DROP VIEW IF EXISTS public.popular_wallpapers_monthly;
DROP VIEW IF EXISTS public.popular_wallpapers_weekly;
DROP VIEW IF EXISTS public.popular_wallpapers;
DROP VIEW IF EXISTS public.download_stats;
DROP VIEW IF EXISTS public.view_stats;

-- 验证：确认旧视图已经不在 public schema 中
SELECT
  table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'view_stats',
    'download_stats',
    'popular_wallpapers',
    'popular_wallpapers_weekly',
    'popular_wallpapers_monthly'
  )
ORDER BY table_name;
