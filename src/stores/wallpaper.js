// ========================================
// 壁纸数据管理 Store (优化版 - 按需加载 + Web Worker)
// ========================================

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { decodeDataWithWorker } from '@/services/wallpaper/decoder'
import { delay, fetchWithRetry } from '@/services/wallpaper/fetch'
import { LRUCache } from '@/utils/cache/LRUCache'
import { DATA_CACHE_BUSTER, SERIES_CONFIG } from '@/utils/config/constants'
import { classifyWallpaperError, getWallpaperErrorMessage } from '@/utils/wallpaper/errors'
import { normalizeWallpaperFilename } from '@/utils/wallpaper/identity'
import { formatWallpaperStatistics, transformBingWallpaper, transformWallpaperUrls } from '@/utils/wallpaper/transformers'

export const useWallpaperStore = defineStore('wallpaper', () => {
  // ========================================
  // State
  // ========================================

  // 系列数据缓存（只存储索引信息，最多缓存 5 个系列）
  const seriesIndexCache = ref({})

  // 分类数据缓存（使用 LRU 缓存，最多保留 15 个分类，约 60MB）
  const categoryCache = new LRUCache(15)

  // 系列最新切片缓存（用于首屏稳定预热）
  const seriesLatestCache = ref({})

  // Bing 壁纸缓存（完整加载后缓存）
  const bingWallpapersCache = ref(null)
  const bingYearLookupCache = ref({})

  // 当前加载的壁纸列表（合并后的）
  const wallpapers = ref([])

  // 当前加载的系列
  const currentLoadedSeries = ref('')
  const currentRenderedSeries = ref('')

  // 已加载的分类列表（当前系列）
  const loadedCategories = ref(new Set())

  // 加载状态
  const loading = ref(false)
  const error = ref(null)
  const errorType = ref(null) // 'network' | 'parse' | 'format' | 'unknown'

  // 后台加载状态（用于控制 UI 是否显示加载中的数量变化）
  const isBackgroundLoading = ref(false)

  // 首次加载完成后的初始数量（用于在后台加载期间稳定显示）
  const initialLoadedCount = ref(0)

  // 系列总数量（从索引文件中获取，用于显示预期总数）
  const expectedTotal = ref(0)

  const retryConfig = {
    retries: 3,
    retryDelay: 1000,
  }

  // 请求版本号（用于防止竞态条件）
  let requestVersion = 0

  function compareWallpapers(a, b) {
    const dateDiff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    if (dateDiff !== 0) {
      return dateDiff
    }

    return String(a.filename || '').localeCompare(String(b.filename || ''))
  }

  function sortWallpapers(wallpaperList) {
    return [...wallpaperList].sort(compareWallpapers)
  }

  // ========================================
  // Getters
  // ========================================

  const total = computed(() => wallpapers.value.length)

  // 用于 UI 显示的稳定总数（后台加载期间显示预期总数，避免误导用户）
  const displayTotal = computed(() => {
    // 如果正在后台加载且有预期总数，显示预期总数（避免误导用户）
    if (isBackgroundLoading.value && expectedTotal.value > 0) {
      return expectedTotal.value
    }
    // 如果有预期总数且已加载完成，显示实际数量
    if (expectedTotal.value > 0 && !isBackgroundLoading.value) {
      return wallpapers.value.length
    }
    // 默认显示实际数量
    return wallpapers.value.length
  })

  const loaded = computed(() => wallpapers.value.length > 0)

  // 统计信息
  const statistics = computed(() => {
    return formatWallpaperStatistics(wallpapers.value)
  })

  // ========================================
  // Actions
  // ========================================

  /**
   * 加载系列的分类索引（只加载索引，不加载具体数据）
   */
  async function loadSeriesIndex(seriesId) {
    // 如果已有缓存，直接返回
    if (seriesIndexCache.value[seriesId]) {
      return seriesIndexCache.value[seriesId]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      const response = await fetchWithRetry(seriesConfig.indexUrl, {}, retryConfig)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

      // 解密分类列表（使用 Worker）
      let indexData
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const categories = await decodeDataWithWorker(encoded)
          indexData = {
            generatedAt: data.generatedAt,
            series: data.series,
            seriesName: data.seriesName,
            total: data.total,
            categoryCount: data.categoryCount,
            categories,
            schema: data.schema,
            env: data.env,
          }
        }
        catch (err) {
          console.warn('Failed to decode category index:', err)
          // 如果解码失败，尝试使用原始数据
          if (data.categories) {
            indexData = data
          }
          else {
            const decodeErr = new Error('Failed to decode category index')
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        indexData = data
      }

      // 验证数据格式
      if (!indexData.categories || !Array.isArray(indexData.categories)) {
        const err = new Error('Invalid index data format: missing categories array')
        errorType.value = 'format'
        throw err
      }

      // 存入缓存
      seriesIndexCache.value[seriesId] = indexData
      return indexData
    }
    catch (e) {
      const errType = classifyWallpaperError(e)
      errorType.value = errType
      console.error(`Failed to load series index for ${seriesId}:`, e)
      throw e
    }
  }

  /**
   * 加载单个分类的数据
   */
  async function loadCategory(seriesId, categoryFile) {
    const cacheKey = `${seriesId}:${categoryFile}`

    // 如果已有缓存，直接返回
    if (categoryCache.has(cacheKey)) {
      return categoryCache.get(cacheKey)
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      // 处理360系列的分类加载
      if (seriesId === '360') {
        // 从categoryFile中提取分类ID
        const categoryId = categoryFile.replace('.json', '')
        
        // 调用360 API获取分类壁纸（使用代理）
        const wallpapersUrl = `/360-wallpaper/index.php?c=WallPaper&a=getAppsByCategory&cid=${categoryId}&start=0&count=50&from=360chrome`
        const response = await fetchWithRetry(wallpapersUrl, {}, retryConfig)
        const data = await response.json()
        
        // 验证数据格式
        if (!data.data || !Array.isArray(data.data)) {
          const err = new Error(`Invalid 360 category data format: ${categoryFile}`)
          errorType.value = 'format'
          throw err
        }
        
        // 获取分类名称
        const indexData = seriesIndexCache.value[seriesId]
        const category = indexData?.categories?.find(c => c.id === categoryId) || { name: '360壁纸' }
        
        // 转换数据格式
        const wallpaperList = data.data.map((item, index) => {
          // 提取合适的标题
          let title = '360壁纸'
          if (item.tag && typeof item.tag === 'string') {
            const tags = item.tag.split(',').filter(Boolean)
            if (tags.length > 0) {
              title = tags[0] // 使用第一个标签作为标题
            }
          }
          if (item.title && typeof item.title === 'string' && item.title.trim()) {
            title = item.title
          }
          
          return {
            id: `360-${item.id}`,
            filename: `360-${item.id}.jpg`,
            category: category.name,
            displayTitle: title,
            url: item.img_1600_900 || item.url,
            downloadUrl: item.img_url || item.img_1920_1080 || item.img_1600_900 || item.url,
            thumbnailUrl: item.img_1600_900 || item.url,
            previewUrl: item.img_1600_900 || item.url,
            title: title,
            tag: item.tag,
            size: 0,
            format: 'JPG',
            createdAt: new Date().toISOString(),
            resolution: {
              width: 1600,
              height: 900,
              label: '1600x900',
              type: 'primary'
            },
            is360: true,
            tags: item.tag ? item.tag.split(',').filter(Boolean) : []
          }
        })
        
        // 按创建时间降序排序
        const transformedList = wallpaperList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        
        // 存入缓存（LRU 会自动淘汰旧数据）
        categoryCache.set(cacheKey, transformedList)
        return transformedList
      }
      
      // 处理其他系列的分类加载
      const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryFile}${DATA_CACHE_BUSTER}`
      const response = await fetchWithRetry(categoryUrl, {}, retryConfig)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON for category ${categoryFile}: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

      // 解密数据（使用 Worker）
      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const decoded = await decodeDataWithWorker(encoded)
          wallpaperList = decoded.wallpapers || decoded
        }
        catch (err) {
          console.warn(`Failed to decode category ${categoryFile}:`, err)
          // 如果解码失败，尝试使用原始数据
          wallpaperList = data.wallpapers || []
          if (!wallpaperList || !Array.isArray(wallpaperList)) {
            const decodeErr = new Error(`Failed to decode category ${categoryFile}`)
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 验证数据格式
      if (!Array.isArray(wallpaperList)) {
        const err = new Error(`Invalid category data format: ${categoryFile}`)
        errorType.value = 'format'
        throw err
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存（LRU 会自动淘汰旧数据）
      categoryCache.set(cacheKey, transformedList)
      return transformedList
    }
    catch (e) {
      const errType = classifyWallpaperError(e)
      errorType.value = errType
      console.error(`Failed to load category ${categoryFile}:`, e)
      throw e
    }
  }

  /**
   * 加载系列的最新切片数据（用于首屏预热，不参与中间态渲染）
   */
  async function loadSeriesLatest(seriesId, forceRefresh = false) {
    // 处理360系列的最新数据加载
    if (seriesId === '360') {
      if (!forceRefresh && seriesLatestCache.value[seriesId]) {
        return seriesLatestCache.value[seriesId]
      }

      try {
        // 先获取分类列表（使用代理）
        const categoriesUrl = '/360-api/index.php?c=WallPaper&a=getAllCategoriesV2&from=360chrome'
        const categoriesResponse = await fetchWithRetry(categoriesUrl, {}, retryConfig)
        const categoriesData = await categoriesResponse.json()

        if (categoriesData.data && Array.isArray(categoriesData.data) && categoriesData.data.length > 0) {
          // 选择第一个分类获取最新壁纸（使用代理）
          const firstCategory = categoriesData.data[0]
          const wallpapersUrl = `/360-wallpaper/index.php?c=WallPaper&a=getAppsByCategory&cid=${firstCategory.id}&start=0&count=50&from=360chrome`
          const wallpapersResponse = await fetchWithRetry(wallpapersUrl, {}, retryConfig)
          const wallpapersData = await wallpapersResponse.json()

          if (wallpapersData.data && Array.isArray(wallpapersData.data)) {
            // 转换数据格式
            const wallpaperList = wallpapersData.data.map((item, index) => {
              // 提取合适的标题
              let title = '360壁纸'
              if (item.tag && typeof item.tag === 'string') {
                const tags = item.tag.split(',').filter(Boolean)
                if (tags.length > 0) {
                  title = tags[0] // 使用第一个标签作为标题
                }
              }
              if (item.title && typeof item.title === 'string' && item.title.trim()) {
                title = item.title
              }
              
              return {
                id: `360-${item.id}`,
                filename: `360-${item.id}.jpg`,
                category: firstCategory.name,
                displayTitle: title,
                url: item.img_1600_900 || item.url,
                downloadUrl: item.img_url || item.img_1920_1080 || item.img_1600_900 || item.url,
                thumbnailUrl: item.img_1600_900 || item.url,
                previewUrl: item.img_1600_900 || item.url,
                title: title,
                tag: item.tag,
                size: 0,
                format: 'JPG',
                createdAt: new Date().toISOString(),
                resolution: {
                  width: 1600,
                  height: 900,
                  label: '1600x900',
                  type: 'primary'
                },
                is360: true,
                tags: item.tag ? item.tag.split(',').filter(Boolean) : []
              }
            })

            // 按创建时间降序排序
            const transformedList = wallpaperList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            seriesLatestCache.value[seriesId] = transformedList
            return transformedList
          }
        }
        return []
      }
      catch (e) {
        console.warn(`Failed to load latest slice for ${seriesId}:`, e)
        return []
      }
    }

    // 处理其他系列的最新数据加载
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig?.latestUrl) {
      return []
    }

    if (!forceRefresh && seriesLatestCache.value[seriesId]) {
      return seriesLatestCache.value[seriesId]
    }

    try {
      const response = await fetchWithRetry(seriesConfig.latestUrl, {}, retryConfig)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        throw new Error(`Failed to parse latest JSON: ${parseError.message}`)
      }

      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const decoded = await decodeDataWithWorker(encoded)
          wallpaperList = decoded.wallpapers || decoded.items || decoded
        }
        catch (err) {
          console.warn(`Failed to decode latest slice for ${seriesId}:`, err)
          wallpaperList = data.wallpapers || data.items || []
          if (!Array.isArray(wallpaperList)) {
            throw new TypeError(`Failed to decode latest slice for ${seriesId}`)
          }
        }
      }
      else {
        wallpaperList = data.wallpapers || data.items || []
      }

      if (!Array.isArray(wallpaperList)) {
        throw new TypeError(`Invalid latest slice format for ${seriesId}`)
      }

      const transformedList = sortWallpapers(wallpaperList.map(w => transformWallpaperUrls(w)))
      seriesLatestCache.value[seriesId] = transformedList
      return transformedList
    }
    catch (e) {
      console.warn(`Failed to load latest slice for ${seriesId}:`, e)
      return []
    }
  }

  /**
   * 初始化每日 Bing 壁纸系列
   * Bing 系列使用年度数据文件结构，不同于其他系列的分类结构
   * 优化：只加载当前年份数据，用户切换月份时按需加载其他年份
   */
  async function initBingSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 检查缓存：如果有缓存的 Bing 数据，直接使用
    if (!forceRefresh && bingWallpapersCache.value && bingWallpapersCache.value.length > 0) {
      wallpapers.value = bingWallpapersCache.value
      currentLoadedSeries.value = seriesId
      currentRenderedSeries.value = seriesId
      loading.value = false
      error.value = null
      errorType.value = null
      isBackgroundLoading.value = false
      expectedTotal.value = bingWallpapersCache.value.length
      // 恢复 loadedCategories，防止切换系列后数据重复加载
      loadedCategories.value = new Set()
      bingWallpapersCache.value.forEach((w) => {
        loadedCategories.value.add(w.date)
        // 同时添加年份标记
        const year = w.date.substring(0, 4)
        loadedCategories.value.add(year)
      })
      return
    }

    // 递增请求版本号，用于防止竞态条件
    const currentRequestVersion = ++requestVersion

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    const seriesConfig = SERIES_CONFIG[seriesId]

    try {
      // 1. 加载 Bing 索引文件
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl, {}, retryConfig)
      const indexData = await indexResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 保存索引数据到缓存
      seriesIndexCache.value[seriesId] = indexData

      // 2. 只加载当前年份的数据（一次性加载，不分两步）
      const currentYear = new Date().getFullYear()
      const currentYearInfo = indexData.years?.find(y => y.year === currentYear)

      if (currentYearInfo) {
        const yearUrl = `${seriesConfig.yearBaseUrl}/${currentYearInfo.file}${DATA_CACHE_BUSTER}`
        const yearResponse = await fetchWithRetry(yearUrl, {}, retryConfig)
        const yearData = await yearResponse.json()

        // 再次检查请求是否过期
        if (requestVersion !== currentRequestVersion) {
          return
        }

        if (yearData.items && Array.isArray(yearData.items)) {
          // 转换数据格式
          const transformedItems = yearData.items.map((item, index) =>
            transformBingWallpaper(item, index),
          )

          // 按日期降序排序
          transformedItems.sort((a, b) => b.date.localeCompare(a.date))

          // 一次性设置数据
          wallpapers.value = transformedItems
          currentRenderedSeries.value = seriesId
          initialLoadedCount.value = transformedItems.length
          expectedTotal.value = transformedItems.length

          // 标记已加载的年份
          loadedCategories.value.add(currentYear.toString())

          // 标记已加载的日期
          transformedItems.forEach((w) => {
            loadedCategories.value.add(w.date)
          })
        }
      }

      // 3. 清除错误状态
      error.value = null
      errorType.value = null
    }
    catch (e) {
      // 如果请求已过期，不处理错误
      if (requestVersion !== currentRequestVersion) {
        return
      }
      console.error(`Failed to init Bing series:`, e)
      const errType = classifyWallpaperError(e)
      errorType.value = errType
      error.value = getWallpaperErrorMessage(e, errType, '每日 Bing 壁纸')
      wallpapers.value = []
      currentRenderedSeries.value = ''
    }
    finally {
      // 只有当请求未过期时才更新 loading 状态
      if (requestVersion === currentRequestVersion) {
        loading.value = false
      }
    }
  }

  /**
   * 加载指定年份的 Bing 数据（用户切换月份时按需加载）
   */
  async function loadBingYear(year) {
    const seriesId = 'bing'
    const seriesConfig = SERIES_CONFIG[seriesId]

    // 如果已加载该年份，跳过
    if (loadedCategories.value.has(year.toString())) {
      return
    }

    // 记录当前请求版本号
    const currentRequestVersion = requestVersion

    // 获取索引数据
    let indexData = seriesIndexCache.value[seriesId]
    if (!indexData) {
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl, {}, retryConfig)
      indexData = await indexResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      seriesIndexCache.value[seriesId] = indexData
    }

    // 查找年份信息
    const yearInfo = indexData.years?.find(y => y.year === year)
    if (!yearInfo) {
      console.warn(`Year ${year} not found in Bing index`)
      return
    }

    try {
      const yearUrl = `${seriesConfig.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`
      const yearResponse = await fetchWithRetry(yearUrl, {}, retryConfig)
      const yearData = await yearResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      if (yearData.items && Array.isArray(yearData.items)) {
        // 过滤已加载的数据
        const newItems = yearData.items.filter(
          item => !loadedCategories.value.has(item.date),
        )

        if (newItems.length > 0) {
          // 转换数据格式
          const transformedItems = newItems.map((item, index) =>
            transformBingWallpaper(item, wallpapers.value.length + index),
          )

          // 标记已加载
          newItems.forEach((item) => {
            loadedCategories.value.add(item.date)
          })

          // 合并并排序
          const merged = [...wallpapers.value, ...transformedItems]
          merged.sort((a, b) => b.date.localeCompare(a.date))
          wallpapers.value = merged

          // 更新计数
          initialLoadedCount.value = wallpapers.value.length
          expectedTotal.value = wallpapers.value.length
        }
      }

      // 标记年份已加载
      loadedCategories.value.add(year.toString())

      // 更新缓存
      bingWallpapersCache.value = [...wallpapers.value]
    }
    catch (e) {
      console.warn(`Failed to load Bing year ${year}:`, e)
    }
  }

  async function loadBingYearData(year) {
    if (!Number.isInteger(year)) {
      return []
    }

    if (bingYearLookupCache.value[year]) {
      return bingYearLookupCache.value[year]
    }

    const seriesId = 'bing'
    const seriesConfig = SERIES_CONFIG[seriesId]
    let indexData = seriesIndexCache.value[seriesId]

    if (!indexData) {
      const indexUrl = seriesConfig.indexUrl
      const indexResponse = await fetchWithRetry(indexUrl, {}, retryConfig)
      indexData = await indexResponse.json()
      seriesIndexCache.value[seriesId] = indexData
    }

    const yearInfo = indexData.years?.find(item => item.year === year)
    if (!yearInfo) {
      return []
    }

    const yearUrl = `${seriesConfig.yearBaseUrl}/${yearInfo.file}${DATA_CACHE_BUSTER}`
    const yearResponse = await fetchWithRetry(yearUrl, {}, retryConfig)
    const yearData = await yearResponse.json()
    const transformedItems = Array.isArray(yearData.items)
      ? yearData.items.map(item => transformBingWallpaper(item))
      : []

    bingYearLookupCache.value[year] = transformedItems
    return transformedItems
  }

  /**
   * 初始化360壁纸系列
   * 360系列使用API接口获取数据，不同于其他系列的本地数据结构
   */
  async function init360Series(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 递增请求版本号，用于防止竞态条件
    const currentRequestVersion = ++requestVersion

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    try {
      // 1. 先获取360壁纸的分类列表（使用代理）
      const categoriesUrl = '/360-api/index.php?c=WallPaper&a=getAllCategoriesV2&from=360chrome'
      const categoriesResponse = await fetchWithRetry(categoriesUrl, {}, retryConfig)
      const categoriesData = await categoriesResponse.json()

      // 检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 2. 保存分类数据到索引缓存，调整分类排序
      let categories = categoriesData.data || []
      
      // 调整分类排序：4K专区第一，美女模特第二，其他按原始顺序
      const sortedCategories = []
      const remainingCategories = []
      
      categories.forEach(cat => {
        if (cat.name === '4K专区') {
          sortedCategories[0] = cat
        } else if (cat.name === '美女模特') {
          sortedCategories[1] = cat
        } else {
          remainingCategories.push(cat)
        }
      })
      
      // 填充空位置并添加剩余分类
      if (!sortedCategories[0]) {
        sortedCategories[0] = remainingCategories.shift()
      }
      if (!sortedCategories[1]) {
        sortedCategories[1] = remainingCategories.shift()
      }
      
      // 添加剩余分类
      sortedCategories.push(...remainingCategories)
      categories = sortedCategories
      
      seriesIndexCache.value[seriesId] = {
        generatedAt: new Date().toISOString(),
        series: seriesId,
        seriesName: '360壁纸',
        total: 0,
        categoryCount: categories.length,
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          file: `${cat.id}.json`
        })),
        schema: 2,
        env: 'production'
      }

      // 3. 加载前5个分类的壁纸数据，确保有足够的初始数据
      if (categories.length > 0) {
        const initialCategoriesCount = Math.min(5, categories.length) // 加载前5个分类
        const allWallpapers = []
        
        for (let i = 0; i < initialCategoriesCount; i++) {
          const category = categories[i]
          const wallpapersUrl = `/360-wallpaper/index.php?c=WallPaper&a=getAppsByCategory&cid=${category.id}&start=0&count=50&from=360chrome`
          const wallpapersResponse = await fetchWithRetry(wallpapersUrl, {}, retryConfig)
          const wallpapersData = await wallpapersResponse.json()

          if (wallpapersData.data && Array.isArray(wallpapersData.data)) {
            // 转换数据格式
        const transformedItems = wallpapersData.data.map((item, index) => {
          // 提取合适的标题
          let title = '360壁纸'
          if (item.tag && typeof item.tag === 'string') {
            const tags = item.tag.split(',').filter(Boolean)
            if (tags.length > 0) {
              title = tags[0] // 使用第一个标签作为标题
            }
          }
          if (item.title && typeof item.title === 'string' && item.title.trim()) {
            title = item.title
          }

          // 生成稳定的创建时间，确保排序稳定
          // 使用递减的时间戳，确保新加载的壁纸总是在列表的末尾
          const baseTime = new Date().getTime()
          const stableTime = new Date(baseTime - index * 1000)

          return {
            id: `360-${item.id}`,
            filename: `360-${item.id}.jpg`,
            category: category.name,
            displayTitle: title,
            url: item.img_1600_900 || item.url,
            downloadUrl: item.img_url || item.img_1920_1080 || item.img_1600_900 || item.url,
            thumbnailUrl: item.img_1600_900 || item.url,
            previewUrl: item.img_1600_900 || item.url,
            title: title,
            tag: item.tag,
            size: 0,
            format: 'JPG',
            createdAt: stableTime.toISOString(),
            resolution: {
              width: 1600,
              height: 900,
              label: '1600x900',
              type: 'primary'
            },
            is360: true,
            tags: item.tag ? item.tag.split(',').filter(Boolean) : []
          }
        })
            allWallpapers.push(...transformedItems)
            // 标记已加载的分类
            loadedCategories.value.add(category.id.toString())
          }
        }

        if (allWallpapers.length > 0) {
          // 按创建时间降序排序
          allWallpapers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          // 一次性设置数据
          wallpapers.value = allWallpapers
          currentRenderedSeries.value = seriesId
          initialLoadedCount.value = allWallpapers.length
          expectedTotal.value = allWallpapers.length
        }
      }

      // 4. 清除错误状态
      error.value = null
      errorType.value = null
    }
    catch (e) {
      // 如果请求已过期，不处理错误
      if (requestVersion !== currentRequestVersion) {
        return
      }
      console.error(`Failed to init 360 series:`, e)
      const errType = errorType.value || classifyWallpaperError(e)
      errorType.value = errType
      error.value = getWallpaperErrorMessage(e, errType, `系列: ${seriesId}`)
      wallpapers.value = []
      currentRenderedSeries.value = ''
    }
    finally {
      // 只有当请求未过期时才更新 loading 状态
      if (requestVersion === currentRequestVersion) {
        loading.value = false
      }
    }
  }

  /**
   * 加载360壁纸的更多分类
   * 用于当用户滚动到页面底部时，加载更多未加载的分类
   */
  async function loadMore360Categories() {
    if (currentLoadedSeries.value !== '360') {
      return
    }

    const indexData = seriesIndexCache.value['360']
    if (!indexData || !indexData.categories) {
      return
    }

    // 找到下一个未加载的分类
    const nextCategory = indexData.categories.find(cat => 
      !loadedCategories.value.has(cat.id.toString())
    )

    if (!nextCategory) {
      return // 没有更多分类可加载
    }

    try {
      isBackgroundLoading.value = true
      
      // 加载下一个分类的数据
      const wallpapersUrl = `/360-wallpaper/index.php?c=WallPaper&a=getAppsByCategory&cid=${nextCategory.id}&start=0&count=50&from=360chrome`
      const wallpapersResponse = await fetchWithRetry(wallpapersUrl, {}, retryConfig)
      const wallpapersData = await wallpapersResponse.json()

      if (wallpapersData.data && Array.isArray(wallpapersData.data)) {
        // 计算一个基础时间，确保它比所有现有壁纸的时间都早
        let earliestTime = new Date().getTime() - 86400000 * 365 // 一年前的时间
        if (wallpapers.value.length > 0) {
          const existingTimes = wallpapers.value.map(w => new Date(w.createdAt).getTime())
          earliestTime = Math.min(...existingTimes) - 1000 // 确保新壁纸的时间比所有现有壁纸早1秒
        }
        
        // 转换数据格式
        const transformedItems = wallpapersData.data.map((item, index) => {
          // 提取合适的标题
          let title = '360壁纸'
          if (item.tag && typeof item.tag === 'string') {
            const tags = item.tag.split(',').filter(Boolean)
            if (tags.length > 0) {
              title = tags[0] // 使用第一个标签作为标题
            }
          }
          if (item.title && typeof item.title === 'string' && item.title.trim()) {
            title = item.title
          }

          // 生成稳定的创建时间，确保排序稳定
          // 确保新加载的壁纸总是在列表的末尾
          const stableTime = new Date(earliestTime - index)

          return {
            id: `360-${item.id}`,
            filename: `360-${item.id}.jpg`,
            category: nextCategory.name,
            displayTitle: title,
            url: item.img_1600_900 || item.url,
            downloadUrl: item.img_url || item.img_1920_1080 || item.img_1600_900 || item.url,
            thumbnailUrl: item.img_1600_900 || item.url,
            previewUrl: item.img_1600_900 || item.url,
            title: title,
            tag: item.tag,
            size: 0,
            format: 'JPG',
            createdAt: stableTime.toISOString(),
            resolution: {
              width: 1600,
              height: 900,
              label: '1600x900',
              type: 'primary'
            },
            is360: true,
            tags: item.tag ? item.tag.split(',').filter(Boolean) : []
          }
        })

        // 直接追加到现有壁纸列表的末尾
        // 这样可以确保之前加载的壁纸位置不变
        const updatedWallpapers = [...wallpapers.value, ...transformedItems]
        
        // 替换壁纸列表
        wallpapers.value = updatedWallpapers
        initialLoadedCount.value = wallpapers.value.length
        expectedTotal.value = wallpapers.value.length

        // 标记此分类已加载
        loadedCategories.value.add(nextCategory.id.toString())
      }
    }
    catch (e) {
      console.error(`Failed to load more 360 categories:`, e)
    }
    finally {
      isBackgroundLoading.value = false
    }
  }

  /**
   * 初始化系列（一次性加载完整数据，避免首屏名单二次改写）
   */
  async function initSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    // 检查是否为每日 Bing 系列
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (seriesConfig?.isDaily) {
      return initBingSeries(seriesId, forceRefresh)
    }
    
    // 检查是否为360壁纸系列
    if (seriesId === '360') {
      return init360Series(seriesId, forceRefresh)
    }

    // 递增请求版本号，用于防止竞态条件
    const currentRequestVersion = ++requestVersion

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0
    expectedTotal.value = 0

    try {
      // 1. 加载分类索引
      const indexData = await loadSeriesIndex(seriesId)

      // 检查请求是否过期（用户已切换到其他系列）
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 2. 记录预期总数（从索引文件中获取，用于显示）
      expectedTotal.value = indexData.total || 0

      // 3. 一次性加载全部分类，确保首次可见即为最终顺序
      const allCategories = indexData.categories || []
      const categoryPromises = allCategories.map(cat => loadCategory(seriesId, cat.file))
      const allDataArrays = await Promise.all(categoryPromises)

      // 再次检查请求是否过期
      if (requestVersion !== currentRequestVersion) {
        return
      }

      // 4. 在完整数据准备好后一次性替换，避免“先看一版再重排”
      const mergedWallpapers = sortWallpapers(allDataArrays.flat())
      wallpapers.value = mergedWallpapers
      currentRenderedSeries.value = seriesId

      // 5. 记录已加载的分类
      loadedCategories.value = new Set(allCategories.map(cat => cat.file))

      // 6. 记录初始加载数量（用于 UI 稳定显示）
      initialLoadedCount.value = wallpapers.value.length

      // 7. 清除错误状态
      error.value = null
      errorType.value = null

      // 8. 使用实际数量作为最终总数
      expectedTotal.value = wallpapers.value.length
    }
    catch (e) {
      // 如果请求已过期，不处理错误
      if (requestVersion !== currentRequestVersion) {
        return
      }
      console.error(`Failed to init series ${seriesId}:`, e)
      const errType = errorType.value || classifyWallpaperError(e)
      errorType.value = errType
      error.value = getWallpaperErrorMessage(e, errType, `系列: ${seriesId}`)
      wallpapers.value = []
      currentRenderedSeries.value = ''
    }
    finally {
      // 只有当请求未过期时才更新 loading 状态
      if (requestVersion === currentRequestVersion) {
        loading.value = false
      }
    }
  }

  /**
   * 后台加载剩余分类（不阻塞主流程）
   */
  async function loadRemainingCategories(seriesId, categories) {
    // 批量加载：每次加载3个分类后才更新一次 wallpapers
    const BATCH_SIZE = 3
    const batches = []

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      batches.push(categories.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      // 检查系列是否已切换，如果切换则停止加载
      if (currentLoadedSeries.value !== seriesId) {
        return
      }

      // 过滤已加载的分类
      const unloadedBatch = batch.filter(cat => !loadedCategories.value.has(cat.file))
      if (unloadedBatch.length === 0)
        continue

      try {
        // 并行加载批次内的所有分类
        const batchPromises = unloadedBatch.map(cat => loadCategory(seriesId, cat.file))
        const batchResults = await Promise.all(batchPromises)

        // 再次检查系列是否已切换（加载完成后）
        if (currentLoadedSeries.value !== seriesId) {
          return
        }

        // 合并本批次的数据
        const batchData = batchResults.flat()

        // 一次性追加本批次的所有数据(减少响应式更新次数)
        wallpapers.value = [...wallpapers.value, ...batchData]

        // 标记本批次的分类为已加载
        unloadedBatch.forEach((cat) => {
          loadedCategories.value.add(cat.file)
        })

        // 批次间暂停，避免阻塞主线程
        await delay(150)
      }
      catch (e) {
        console.warn(`Failed to load batch:`, e)
        // 继续加载下一批次
      }
    }

    // 后台加载完成，更新状态（仅当系列未切换时）
    if (currentLoadedSeries.value === seriesId) {
      isBackgroundLoading.value = false
      initialLoadedCount.value = wallpapers.value.length
    }
  }

  /**
   * 加载所有分类（用户主动触发）
   */
  async function loadAllCategories(seriesId) {
    const indexData = seriesIndexCache.value[seriesId]
    if (!indexData) {
      await loadSeriesIndex(seriesId)
      return
    }

    const unloadedCategories = indexData.categories.filter(cat =>
      !loadedCategories.value.has(cat.file),
    )

    if (unloadedCategories.length === 0) {
      return
    }

    loading.value = true
    try {
      await loadRemainingCategories(seriesId, unloadedCategories)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 根据 ID 获取单个壁纸
   */
  function getWallpaperById(id) {
    return wallpapers.value.find(w => w.id === id)
  }

  function getSeriesCategories(seriesId) {
    return seriesIndexCache.value[seriesId]?.categories || []
  }

  async function resolveWallpapersByAssetKeys(assetKeys = []) {
    if (!Array.isArray(assetKeys) || assetKeys.length === 0) {
      return []
    }

    const grouped = assetKeys.reduce((acc, assetKey) => {
      const [series, ...filenameParts] = String(assetKey).split(':')
      const filename = normalizeWallpaperFilename(filenameParts.join(':'), series)

      if (!series || !filename || !SERIES_CONFIG[series]) {
        return acc
      }

      if (!acc[series]) {
        acc[series] = []
      }

      acc[series].push({ assetKey, filename })
      return acc
    }, {})

    const resolvedByKey = new Map()

    await Promise.all(Object.entries(grouped).map(async ([series, items]) => {
      const neededFilenames = new Set(items.map(item => item.filename))
      const matchedByFilename = new Map()

      const collectMatches = (wallpaperList = []) => {
        wallpaperList.forEach((wallpaper) => {
          const filename = normalizeWallpaperFilename(wallpaper?.filename || wallpaper?.id, series)
          if (!filename || !neededFilenames.has(filename) || matchedByFilename.has(filename)) {
            return
          }

          matchedByFilename.set(filename, wallpaper)
        })
      }

      if (currentRenderedSeries.value === series) {
        collectMatches(wallpapers.value)
      }

      if (series === 'bing') {
        collectMatches(bingWallpapersCache.value || [])

        const neededYears = [...new Set(
          items
            .map(({ filename }) => {
              const matched = filename.match(/(\d{4})-\d{2}-\d{2}/)
              return matched ? Number.parseInt(matched[1], 10) : null
            })
            .filter(Number.isInteger),
        )]

        for (const year of neededYears) {
          if (matchedByFilename.size >= neededFilenames.size) {
            break
          }

          collectMatches(await loadBingYearData(year))
        }
      }
      else {
        if (matchedByFilename.size < neededFilenames.size) {
          const latestWallpapers = seriesLatestCache.value[series] || await loadSeriesLatest(series)
          collectMatches(latestWallpapers)
        }

        if (matchedByFilename.size < neededFilenames.size) {
          const indexData = await loadSeriesIndex(series)

          for (const category of indexData.categories || []) {
            if (matchedByFilename.size >= neededFilenames.size) {
              break
            }

            collectMatches(await loadCategory(series, category.file))
          }
        }
      }

      items.forEach(({ assetKey, filename }) => {
        const wallpaper = matchedByFilename.get(filename)
        resolvedByKey.set(
          assetKey,
          wallpaper ? { ...wallpaper, _assetKey: assetKey, _series: series } : null,
        )
      })
    }))

    return assetKeys.map(assetKey => resolvedByKey.get(assetKey) || null)
  }

  /**
   * 获取壁纸索引
   */
  function getWallpaperIndex(id) {
    return wallpapers.value.findIndex(w => w.id === id)
  }

  /**
   * 获取上一张壁纸
   */
  function getPrevWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index > 0) {
      return wallpapers.value[index - 1]
    }
    return null
  }

  /**
   * 获取下一张壁纸
   */
  function getNextWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index < wallpapers.value.length - 1) {
      return wallpapers.value[index + 1]
    }
    return null
  }

  /**
   * 清除缓存
   */
  function clearCache(seriesId) {
    if (seriesId) {
      // 清除指定系列的缓存
      delete seriesIndexCache.value[seriesId]
      delete seriesLatestCache.value[seriesId]
      categoryCache.deleteByPrefix(`${seriesId}:`)
      // 清除 Bing 缓存
      if (seriesId === 'bing') {
        bingWallpapersCache.value = null
        bingYearLookupCache.value = {}
      }
    }
    else {
      // 清除所有缓存
      seriesIndexCache.value = {}
      seriesLatestCache.value = {}
      categoryCache.clear()
      bingWallpapersCache.value = null
      bingYearLookupCache.value = {}
    }
  }

  /**
   * 加载360壁纸具体分类的更多分页数据
   * 用于当用户在具体分类页面滚动到底部时加载更多
   */
  async function loadMore360CategoryPage(categoryName, page = 1) {
    if (currentLoadedSeries.value !== '360') {
      return
    }

    const indexData = seriesIndexCache.value['360']
    if (!indexData || !indexData.categories) {
      return
    }

    // 找到对应的分类
    const category = indexData.categories.find(cat => cat.name === categoryName)
    if (!category) {
      return
    }

    try {
      isBackgroundLoading.value = true
      
      // 计算起始位置（每页50条）
      const start = page * 50
      
      // 加载更多数据
      const wallpapersUrl = `/360-wallpaper/index.php?c=WallPaper&a=getAppsByCategory&cid=${category.id}&start=${start}&count=50&from=360chrome`
      const wallpapersResponse = await fetchWithRetry(wallpapersUrl, {}, retryConfig)
      const wallpapersData = await wallpapersResponse.json()

      if (wallpapersData.data && Array.isArray(wallpapersData.data) && wallpapersData.data.length > 0) {
        // 计算一个基础时间，确保它比所有现有壁纸的时间都早
        let earliestTime = new Date().getTime() - 86400000 * 365 // 一年前的时间
        if (wallpapers.value.length > 0) {
          const existingTimes = wallpapers.value.map(w => new Date(w.createdAt).getTime())
          earliestTime = Math.min(...existingTimes) - 1000 // 确保新壁纸的时间比所有现有壁纸早1秒
        }
        
        // 转换数据格式
        const transformedItems = wallpapersData.data.map((item, index) => {
          // 提取合适的标题
          let title = '360壁纸'
          if (item.tag && typeof item.tag === 'string') {
            const tags = item.tag.split(',').filter(Boolean)
            if (tags.length > 0) {
              title = tags[0] // 使用第一个标签作为标题
            }
          }
          if (item.title && typeof item.title === 'string' && item.title.trim()) {
            title = item.title
          }

          // 生成稳定的创建时间，确保排序稳定
          // 确保新加载的壁纸总是在列表的末尾
          const stableTime = new Date(earliestTime - index)

          return {
            id: `360-${item.id}`,
            filename: `360-${item.id}.jpg`,
            category: category.name,
            displayTitle: title,
            url: item.img_1600_900 || item.url,
            downloadUrl: item.img_url || item.img_1920_1080 || item.img_1600_900 || item.url,
            thumbnailUrl: item.img_1600_900 || item.url,
            previewUrl: item.img_1600_900 || item.url,
            title: title,
            tag: item.tag,
            size: 0,
            format: 'JPG',
            createdAt: stableTime.toISOString(),
            resolution: {
              width: 1600,
              height: 900,
              label: '1600x900',
              type: 'primary'
            },
            is360: true,
            tags: item.tag ? item.tag.split(',').filter(Boolean) : []
          }
        })

        // 过滤出当前分类的壁纸
        const currentCategoryWallpapers = wallpapers.value.filter(w => w.category === categoryName)
        
        // 直接追加到当前分类的壁纸列表
        // 由于我们已经确保新壁纸的时间戳比现有壁纸晚，所以不需要重新排序
        const newCategoryWallpapers = [...currentCategoryWallpapers, ...transformedItems]
        
        // 替换整个壁纸列表，但保持其他分类的壁纸位置不变
        // 遍历原始壁纸列表，只替换当前分类的壁纸
        const updatedWallpapers = []
        let hasAddedCategory = false
        
        for (const wallpaper of wallpapers.value) {
          if (wallpaper.category === categoryName) {
            // 第一次遇到当前分类时，添加所有新的分类壁纸
            if (!hasAddedCategory) {
              updatedWallpapers.push(...newCategoryWallpapers)
              hasAddedCategory = true
            }
            // 跳过原始的分类壁纸，因为我们已经添加了更新后的版本
          } else {
            // 保留其他分类的壁纸
            updatedWallpapers.push(wallpaper)
          }
        }
        
        // 如果原始列表中没有当前分类的壁纸（可能是第一次加载），直接添加到末尾
        if (!hasAddedCategory) {
          updatedWallpapers.push(...newCategoryWallpapers)
        }
        
        // 替换壁纸列表
        wallpapers.value = updatedWallpapers
        initialLoadedCount.value = wallpapers.value.length
        expectedTotal.value = wallpapers.value.length
      }
    }
    catch (e) {
      console.error(`Failed to load more 360 category page:`, e)
    }
    finally {
      isBackgroundLoading.value = false
    }
  }

  return {
    // State
    wallpapers,
    loading,
    error,
    errorType,
    currentLoadedSeries,
    currentRenderedSeries,
    loadedCategories,
    isBackgroundLoading,
    // Getters
    total,
    displayTotal,
    loaded,
    statistics,
    // Actions
    initSeries,
    loadAllCategories,
    loadCategory,
    loadSeriesLatest,
    loadBingYear,
    loadMore360Categories,
    loadMore360CategoryPage,
    resolveWallpapersByAssetKeys,
    getWallpaperById,
    getSeriesCategories,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
    clearCache,
  }
})
