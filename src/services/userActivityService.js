import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { buildWallpaperAssetKey } from '@/utils/wallpaper/identity'

function getDownloadResolutionLabel(wallpaper) {
  return wallpaper?.resolution?.label || null
}

function getDownloadFormat(wallpaper) {
  if (wallpaper?.format) {
    return String(wallpaper.format).toUpperCase()
  }

  const extension = String(wallpaper?.filename || '').split('.').pop()
  return extension ? extension.toUpperCase() : null
}

export async function recordAuthenticatedDownloadHistory(wallpaper, series) {
  if (!isSupabaseConfigured()) {
    return
  }

  const assetKey = buildWallpaperAssetKey(wallpaper?.filename || wallpaper?.id, series)
  if (!assetKey) {
    return
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    return
  }

  const { error } = await supabase
    .from('user_download_history')
    .insert({
      asset_key: assetKey,
      context: {
        category: wallpaper?.category || null,
        filename: wallpaper?.filename || null,
        subcategory: wallpaper?.subcategory || null,
      },
      file_format: getDownloadFormat(wallpaper),
      resolution_label: getDownloadResolutionLabel(wallpaper),
      source: 'web',
      user_id: session.user.id,
    })

  if (error) {
    throw error
  }
}
