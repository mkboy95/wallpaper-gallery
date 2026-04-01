const BING_FILENAME_PATTERN = /^bing-\d{4}-\d{2}-\d{2}\.jpg$/i
const BING_DATE_FILENAME_PATTERN = /^\d{4}-\d{2}-\d{2}\.jpg$/i

export function normalizeWallpaperFilename(filenameOrId, series) {
  if (!filenameOrId) {
    return ''
  }

  const normalized = String(filenameOrId).trim()
  if (!normalized) {
    return ''
  }

  if (series === 'bing') {
    if (BING_FILENAME_PATTERN.test(normalized)) {
      return normalized
    }

    if (BING_DATE_FILENAME_PATTERN.test(normalized)) {
      return `bing-${normalized}`
    }
  }

  return normalized
}

export function buildWallpaperAssetKey(filenameOrId, series) {
  const normalizedFilename = normalizeWallpaperFilename(filenameOrId, series)
  if (!normalizedFilename || !series) {
    return ''
  }
  return `${series}:${normalizedFilename}`
}

export function getWallpaperIdentity(wallpaper, series) {
  const filename = normalizeWallpaperFilename(wallpaper?.filename || wallpaper?.id, series)
  return {
    assetKey: buildWallpaperAssetKey(filename, series),
    filename,
    series,
  }
}
