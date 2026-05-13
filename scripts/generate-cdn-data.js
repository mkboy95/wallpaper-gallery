#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { encodeData } from '../src/utils/common/codec.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OUTPUT_DIR = process.env.CDN_DATA_DIR || path.resolve(__dirname, '../nuanXinProPic/data')

const SERIES_LIST = ['mobile', 'desktop', 'avatar']
const LATEST_LIMIT = 40

async function fetchAllAssets(supabase) {
  const assets = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('wallpaper_assets')
      .select('*')
      .eq('status', 'active')
      .order('source_updated_at', { ascending: false })
      .range(from, from + batchSize - 1)

    if (error) {
      throw error
    }

    if (!data?.length) {
      break
    }

    assets.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return assets
}

function assetToWallpaper(asset) {
  const wp = {
    filename: asset.filename,
    category: asset.category,
    subcategory: asset.subcategory,
    displayTitle: asset.title,
    path: asset.source_path,
    previewPath: asset.preview_path,
    thumbnailPath: asset.thumbnail_path,
    createdAt: asset.source_updated_at,
    size: asset.file_size,
    format: asset.format,
    id: asset.metadata?.source_id || asset.asset_key,
  }

  if (asset.width || asset.height) {
    wp.resolution = {
      width: asset.width,
      height: asset.height,
    }
  }

  if (asset.cdn_tag) {
    wp.cdnTag = asset.cdn_tag
  }

  if (asset.metadata?.description) {
    wp.description = asset.metadata.description
  }

  if (asset.metadata?.keywords?.length) {
    wp.keywords = asset.metadata.keywords
  }

  if (asset.metadata?.tags?.length) {
    wp.tags = asset.metadata.tags
  }

  if (asset.metadata?.sha) {
    wp.sha = asset.metadata.sha
  }

  return wp
}

function encodeBlob(data) {
  const json = JSON.stringify(data)
  return encodeData(json)
}

function writeJson(filePath, data) {
  const encoded = {
    blob: encodeBlob(data),
  }
  fs.writeFileSync(filePath, JSON.stringify(encoded))
}

function generateLatestWallpapers(assets) {
  const sorted = [...assets].sort((a, b) => {
    const dateA = a.source_updated_at || ''
    const dateB = b.source_updated_at || ''
    return dateB.localeCompare(dateA)
  })
  return sorted.slice(0, LATEST_LIMIT).map(assetToWallpaper)
}

function generateCategoryIndex(categories) {
  return categories.map(([name, wallpapers]) => ({
    name,
    count: wallpapers.length,
    file: `${encodeURIComponent(name)}.json`,
  }))
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  }

  console.log('📦 从 Supabase 生成 CDN 数据文件...')
  console.log(`输出目录: ${OUTPUT_DIR}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const assets = await fetchAllAssets(supabase)
  console.log(`✅ 从 Supabase 获取 ${assets.length} 条活跃壁纸`)

  let totalFiles = 0

  for (const series of SERIES_LIST) {
    const seriesAssets = assets.filter(a => a.series === series)
    if (!seriesAssets.length) {
      console.log(`⏭️  ${series}: 无数据，跳过`)
      continue
    }

    const seriesDir = path.join(OUTPUT_DIR, series)
    if (!fs.existsSync(seriesDir)) {
      fs.mkdirSync(seriesDir, { recursive: true })
    }

    const categoryMap = new Map()
    for (const asset of seriesAssets) {
      const cat = asset.category || '未分类'
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, [])
      }
      categoryMap.get(cat).push(asset)
    }

    const latestWallpapers = generateLatestWallpapers(seriesAssets)
    const latestPath = path.join(seriesDir, 'latest.json')
    writeJson(latestPath, { wallpapers: latestWallpapers, total: seriesAssets.length })
    totalFiles++
    console.log(`  ✅ ${series}/latest.json (${latestWallpapers.length} 张)`)

    const indexData = generateCategoryIndex([...categoryMap.entries()])
    const indexPath = path.join(seriesDir, 'index.json')
    writeJson(indexPath, { categories: indexData, total: seriesAssets.length })
    totalFiles++
    console.log(`  ✅ ${series}/index.json (${indexData.length} 个分类)`)

    for (const [catName, catAssets] of categoryMap) {
      const catWallpapers = catAssets.map(assetToWallpaper)
      const catPath = path.join(seriesDir, `${encodeURIComponent(catName)}.json`)
      writeJson(catPath, { wallpapers: catWallpapers, total: catAssets.length })
      totalFiles++
    }
    console.log(`  ✅ ${series}: ${categoryMap.size} 个分类文件`)

    const legacyPath = path.join(OUTPUT_DIR, `${series}.json`)
    writeJson(legacyPath, { wallpapers: seriesAssets.map(assetToWallpaper), total: seriesAssets.length })
    totalFiles++
    console.log(`  ✅ ${series}.json (兼容格式)`)
  }

  console.log(`\n🎉 完成！共生成 ${totalFiles} 个数据文件`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('\n❌ 生成 CDN 数据失败:', error.message)
    process.exit(1)
  })
}

export { assetToWallpaper, encodeBlob, main as generateCdnData }
