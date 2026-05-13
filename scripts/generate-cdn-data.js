#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { encodeData } from '../src/utils/common/codec.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OUTPUT_DIR = process.env.CDN_DATA_DIR || path.resolve(__dirname, '../nuanXinProPic/data')

const SERIES_LIST = ['mobile', 'desktop', 'avatar']
const LATEST_LIMIT = 200

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

    if (error) throw error
    if (!data?.length) break

    assets.push(...data)
    if (data.length < batchSize) break
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
    wp.resolution = { width: asset.width, height: asset.height }
  }
  if (asset.cdn_tag) wp.cdnTag = asset.cdn_tag
  if (asset.metadata?.description) wp.description = asset.metadata.description
  if (asset.metadata?.keywords?.length) wp.keywords = asset.metadata.keywords
  if (asset.metadata?.tags?.length) wp.tags = asset.metadata.tags
  if (asset.metadata?.sha) wp.sha = asset.metadata.sha

  return wp
}

function writeJson(filePath, data) {
  const encoded = { blob: encodeData(JSON.stringify(data)) }
  fs.writeFileSync(filePath, JSON.stringify(encoded))
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少环境变量')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const assets = await fetchAllAssets(supabase)
  console.log(`✅ 从 Supabase 获取 ${assets.length} 条壁纸`)

  for (const series of SERIES_LIST) {
    const seriesAssets = assets.filter(a => a.series === series)
    if (!seriesAssets.length) continue

    const seriesDir = path.join(OUTPUT_DIR, series)
    if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true })

    const categoryMap = new Map()
    for (const asset of seriesAssets) {
      const cat = asset.category || '未分类'
      if (!categoryMap.has(cat)) categoryMap.set(cat, [])
      categoryMap.get(cat).push(asset)
    }

    const latest = [...seriesAssets]
      .sort((a, b) => (b.source_updated_at || '').localeCompare(a.source_updated_at || ''))
      .slice(0, LATEST_LIMIT)
      .map(assetToWallpaper)

    writeJson(path.join(seriesDir, 'latest.json'), { wallpapers: latest, total: seriesAssets.length })
    console.log(`  ✅ ${series}/latest.json (${latest.length} 张)`)

    const indexData = [...categoryMap.entries()].map(([name, wps]) => ({
      name,
      count: wps.length,
      file: `${encodeURIComponent(name)}.json`,
    }))
    writeJson(path.join(seriesDir, 'index.json'), { categories: indexData, total: seriesAssets.length })

    for (const [catName, catAssets] of categoryMap) {
      writeJson(
        path.join(seriesDir, `${encodeURIComponent(catName)}.json`),
        { wallpapers: catAssets.map(assetToWallpaper), total: catAssets.length }
      )
    }
    console.log(`  ✅ ${series}: ${categoryMap.size} 个分类`)
  }

  console.log('\n🎉 CDN 数据生成完成')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
