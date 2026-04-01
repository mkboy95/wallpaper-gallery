<script setup>
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageLoadingScene from '@/components/common/feedback/PageLoadingScene.vue'
import RemoteAvatar from '@/components/common/ui/RemoteAvatar.vue'
import HomeModalHost from '@/components/home/HomeModalHost.vue'
import WallpaperCard from '@/components/wallpaper/card/index.vue'
import { useDevice } from '@/composables/useDevice'
import { useAuthStore } from '@/stores/auth'
import { useInteractionStore } from '@/stores/interaction'
import { useWallpaperStore } from '@/stores/wallpaper'
import { getAvatarInitial, getAvatarStyle } from '@/utils/auth/avatarAppearance'
import { SERIES_CONFIG } from '@/utils/config/constants'

const route = useRoute()
const router = useRouter()
const { isMobile } = useDevice()
const authStore = useAuthStore()
const interactionStore = useInteractionStore()
const wallpaperStore = useWallpaperStore()

const {
  avatarCandidates,
  avatarUrl,
  displayName,
  isAuthenticated,
  isConfigured,
  isInitialized,
  isInitializing,
  primaryEmail,
} = storeToRefs(authStore)

const pageState = ref('loading')
const activeTab = ref(resolveLibraryTab(route.query.tab))
const activeSeries = ref(getDefaultActiveSeries())

// 壁纸详情弹窗
const selectedWallpaper = ref(null)
const isModalOpen = ref(false)

const authEmail = computed(() => primaryEmail.value || '')
const authInitial = computed(() => getAvatarInitial(displayName.value || authEmail.value, 'W'))
const authAvatarStyle = computed(() => getAvatarStyle(displayName.value || authEmail.value))

const libraryTitle = computed(() => activeTab.value === 'likes' ? '我的喜欢' : '收藏夹')
const libraryCardActionMode = computed(() => activeTab.value === 'likes' ? 'like-only' : 'collect-only')

const loginRoute = computed(() => ({
  path: '/login',
  query: { redirect: getLibraryRoute(activeTab.value) },
}))

const allSeriesOptions = [
  { id: 'all', name: '全部' },
  { id: 'desktop', name: '电脑壁纸' },
  { id: 'bing', name: '每日 Bing' },
  { id: 'mobile', name: '手机壁纸' },
  { id: 'avatar', name: '头像' },
]

// 系列选项列表
const seriesOptions = computed(() =>
  isMobile.value
    ? allSeriesOptions.filter(option => ['mobile', 'avatar'].includes(option.id))
    : allSeriesOptions,
)

const currentTabItems = computed(() =>
  activeTab.value === 'likes' ? interactionStore.allLikes : interactionStore.allCollectionItems,
)

function getUniqueAssetKeys(items = []) {
  return [...new Set(items.map(item => item?.asset_key).filter(Boolean))]
}

// 根据当前 Tab 和系列筛选，获取 asset_key 列表
const currentAssetKeys = computed(() => {
  const source = activeTab.value === 'likes'
    ? interactionStore.likesBySeries
    : interactionStore.collectionsBySeries

  if (activeSeries.value === 'all') {
    return getUniqueAssetKeys(currentTabItems.value)
  }

  return getUniqueAssetKeys(source[activeSeries.value] || [])
})

// 从 wallpaperStore 缓存中匹配完整壁纸对象
const resolvedWallpapers = ref([])
const resolving = ref(false)
let resolveRequestVersion = 0

// 当前系列统计
const seriesCounts = computed(() => {
  const source = activeTab.value === 'likes'
    ? interactionStore.likesBySeries
    : interactionStore.collectionsBySeries

  return {
    all: getUniqueAssetKeys(currentTabItems.value).length,
    desktop: getUniqueAssetKeys(source.desktop || []).length,
    bing: getUniqueAssetKeys(source.bing || []).length,
    mobile: getUniqueAssetKeys(source.mobile || []).length,
    avatar: getUniqueAssetKeys(source.avatar || []).length,
  }
})

// 当前筛选选中的壁纸 aspect ratio（用于弹窗判断）
const usePortraitModal = computed(() => {
  if (activeSeries.value === 'mobile' || activeSeries.value === 'avatar')
    return true
  if (activeSeries.value === 'all' && selectedWallpaper.value) {
    const key = selectedWallpaper.value._assetKey || ''
    const series = key.split(':')[0]
    return series === 'mobile' || series === 'avatar'
  }
  return false
})

// 当前系列的 aspectRatio
function getAspectRatio(wallpaper) {
  const key = wallpaper?._assetKey || ''
  const series = key.split(':')[0]
  return SERIES_CONFIG[series]?.aspectRatio || '16/10'
}

function resolveLibraryTab(value) {
  return value === 'likes' ? 'likes' : 'collections'
}

function getDefaultActiveSeries() {
  return isMobile.value ? 'mobile' : 'all'
}

function getLibraryRoute(tab = activeTab.value) {
  return `/library?tab=${resolveLibraryTab(tab)}`
}

function syncRouteTab(tab) {
  const normalizedTab = resolveLibraryTab(tab)
  if (route.query.tab === normalizedTab)
    return

  router.replace({
    path: '/library',
    query: { ...route.query, tab: normalizedTab },
  })
}

// 从 asset_key 还原完整壁纸对象
async function resolveWallpapers(assetKeys) {
  if (!assetKeys.length) {
    resolvedWallpapers.value = []
    resolving.value = false
    return
  }

  const resolveVersion = ++resolveRequestVersion
  resolving.value = true

  try {
    const results = await wallpaperStore.resolveWallpapersByAssetKeys(assetKeys)
    if (resolveRequestVersion !== resolveVersion) {
      return
    }

    resolvedWallpapers.value = results.map((wallpaper, index) => {
      if (wallpaper) {
        return wallpaper
      }

      const { filename, series } = parseAssetKey(assetKeys[index])
      return createMinimalWallpaper(assetKeys[index], filename, series)
    })
  }
  finally {
    if (resolveRequestVersion === resolveVersion) {
      resolving.value = false
    }
  }
}

function parseAssetKey(assetKey) {
  const [series, ...filenameParts] = String(assetKey || '').split(':')
  return {
    series,
    filename: filenameParts.join(':'),
  }
}

function createMinimalWallpaper(assetKey, filename, series) {
  const config = SERIES_CONFIG[series]
  if (!config) {
    return {
      id: filename,
      filename,
      _assetKey: assetKey,
      _series: series,
    }
  }

  // Bing 系列特殊处理
  if (series === 'bing') {
    const dateMatch = filename.match(/bing-(\d{4}-\d{2}-\d{2})/)
    return {
      id: filename,
      filename,
      isBing: true,
      date: dateMatch ? dateMatch[1] : '',
      title: filename,
      thumbnailUrl: '', // Bing 缩略图需要 urlbase，这里简化处理
      _assetKey: assetKey,
      _series: series,
    }
  }

  return {
    id: filename,
    filename,
    thumbnailUrl: `${config.thumbnailBaseUrl}/${filename}`,
    previewUrl: `${config.thumbnailBaseUrl}/${filename}`,
    url: `${config.imageBaseUrl}/${filename}`,
    category: '',
    subcategory: '',
    _assetKey: assetKey,
    _series: series,
  }
}

// 壁纸点击 → 打开弹窗
function handleSelectWallpaper(wallpaper) {
  selectedWallpaper.value = wallpaper
  isModalOpen.value = true
}

function handleCloseModal() {
  isModalOpen.value = false
  selectedWallpaper.value = null
}

// 弹窗内上/下切换
function handlePrevWallpaper() {
  if (!selectedWallpaper.value)
    return
  const currentKey = selectedWallpaper.value._assetKey || selectedWallpaper.value.id
  const idx = resolvedWallpapers.value.findIndex(w => (w._assetKey || w.id) === currentKey)
  if (idx > 0) {
    selectedWallpaper.value = resolvedWallpapers.value[idx - 1]
  }
}

function handleNextWallpaper() {
  if (!selectedWallpaper.value)
    return
  const currentKey = selectedWallpaper.value._assetKey || selectedWallpaper.value.id
  const idx = resolvedWallpapers.value.findIndex(w => (w._assetKey || w.id) === currentKey)
  if (idx < resolvedWallpapers.value.length - 1) {
    selectedWallpaper.value = resolvedWallpapers.value[idx + 1]
  }
}

async function ensurePageReady() {
  if (!isConfigured.value) {
    pageState.value = 'unavailable'
    return
  }

  if (!isInitialized.value || isInitializing.value) {
    await authStore.initialize()
  }

  if (!isAuthenticated.value) {
    await router.replace(loginRoute.value)
    return
  }

  syncRouteTab(activeTab.value)

  // 加载用户交互数据
  await interactionStore.loadLibraryData()

  pageState.value = 'ready'
}

// 监听 asset_key 列表变化，解析壁纸对象
watch(currentAssetKeys, (keys) => {
  resolveWallpapers(keys)
}, { immediate: false })

watch(() => route.query.tab, (nextTab) => {
  const normalizedTab = resolveLibraryTab(nextTab)
  if (activeTab.value !== normalizedTab) {
    activeTab.value = normalizedTab
  }
  if (pageState.value === 'ready') {
    syncRouteTab(normalizedTab)
  }
})

watch(activeTab, (nextTab) => {
  activeSeries.value = getDefaultActiveSeries()
  if (pageState.value === 'ready') {
    syncRouteTab(nextTab)
  }
})

watch(seriesOptions, (options) => {
  if (!options.some(option => option.id === activeSeries.value)) {
    activeSeries.value = getDefaultActiveSeries()
  }
}, { immediate: true })

watch(isAuthenticated, (nextValue) => {
  if (pageState.value === 'ready' && !nextValue) {
    pageState.value = 'loading'
    router.replace(loginRoute.value)
  }
})

// pageState 变为 ready 后，立即解析壁纸
watch(pageState, (state) => {
  if (state === 'ready') {
    resolveWallpapers(currentAssetKeys.value)
  }
})

onMounted(() => {
  ensurePageReady()
})
</script>

<template>
  <div class="library-page">
    <div class="container">
      <section class="library-shell">
        <PageLoadingScene
          v-if="pageState === 'loading'"
          title="壁纸库加载中"
          text="正在准备你的壁纸库..."
        />

        <template v-else>
          <header class="library-hero">
            <!-- <span class="library-eyebrow">Library</span> -->
            <h1>收藏夹与我的喜欢</h1>
            <p>在这里管理你收藏和喜欢的壁纸，按系列分类浏览，点击预览图查看详情。</p>
          </header>

          <div v-if="pageState !== 'ready'" class="library-state-card">
            <div class="library-state-card__icon" :class="`is-${pageState}`" />
            <h2>{{ pageState === 'unavailable' ? '当前环境未启用账号系统' : '正在同步你的壁纸库' }}</h2>
            <p>
              {{
                pageState === 'unavailable'
                  ? '当前环境没有启用 Supabase Auth，所以暂时无法访问个人壁纸库。'
                  : '正在恢复登录状态并准备个人入口，请稍候。'
              }}
            </p>
            <RouterLink v-if="pageState !== 'unavailable'" class="library-primary-link" :to="loginRoute">
              前往登录
            </RouterLink>
          </div>

          <section v-else class="library-layout">
            <!-- 侧边栏 -->
            <aside class="library-sidebar">
              <div class="library-profile-card">
                <div class="library-profile-card__avatar-wrap">
                  <RemoteAvatar
                    :sources="avatarCandidates"
                    :src="avatarUrl"
                    :alt="`${displayName} 头像`"
                    :initial="authInitial"
                    :fallback-style="authAvatarStyle"
                    image-class="library-profile-card__avatar-image"
                    fallback-class="library-profile-card__avatar"
                  />
                </div>

                <div class="library-profile-card__copy">
                  <h2>{{ displayName || '未命名用户' }}</h2>
                  <p>{{ authEmail || '当前账号暂未返回邮箱地址' }}</p>
                </div>

                <div class="library-profile-card__stats">
                  <div class="library-profile-card__stat library-profile-card__stat--like">
                    <span>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
                      </svg>
                      喜欢
                    </span>
                    <strong>{{ interactionStore.stats.likes }}</strong>
                  </div>
                  <div class="library-profile-card__stat library-profile-card__stat--collect">
                    <span>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      收藏
                    </span>
                    <strong>{{ interactionStore.stats.collections }}</strong>
                  </div>
                  <div class="library-profile-card__stat">
                    <span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      下载
                    </span>
                    <strong>{{ interactionStore.stats.downloads }}</strong>
                  </div>
                </div>

                <RouterLink class="library-profile-card__link" to="/account">
                  个人设置
                </RouterLink>
              </div>
            </aside>

            <!-- 主内容区 -->
            <section class="library-main">
              <div class="library-content-card">
                <div class="library-content-card__header">
                  <div>
                    <!-- <span class="library-content-card__eyebrow">Your Space</span> -->
                    <h2>{{ libraryTitle }}</h2>
                  </div>
                  <span class="library-content-card__count">{{ seriesCounts[activeSeries] }} 张</span>
                </div>

                <!-- 主 Tab：收藏夹 / 我的喜欢 -->
                <el-tabs v-model="activeTab" class="library-tabs" stretch>
                  <el-tab-pane label="收藏夹" name="collections" />
                  <el-tab-pane label="我的喜欢" name="likes" />
                </el-tabs>

                <!-- 系列筛选胶囊 -->
                <div class="series-filter-pills">
                  <button
                    v-for="opt in seriesOptions"
                    :key="opt.id"
                    class="series-pill"
                    :class="{ 'is-active': activeSeries === opt.id }"
                    @click="activeSeries = opt.id"
                  >
                    {{ opt.name }}
                    <span v-if="seriesCounts[opt.id] > 0" class="series-pill__count">{{ seriesCounts[opt.id] }}</span>
                  </button>
                </div>

                <!-- 加载状态 -->
                <div v-if="interactionStore.libraryLoading || resolving" class="library-loading">
                  <div class="library-loading__spinner" />
                  <span>加载中...</span>
                </div>

                <!-- 壁纸网格 -->
                <div
                  v-else-if="resolvedWallpapers.length > 0"
                  class="library-wallpaper-grid"
                  :class="{
                    'library-wallpaper-grid--masonry': activeSeries === 'all',
                    'is-portrait': activeSeries === 'mobile',
                    'is-square': activeSeries === 'avatar',
                  }"
                >
                  <WallpaperCard
                    v-for="(wallpaper, index) in resolvedWallpapers"
                    :key="wallpaper._assetKey || wallpaper.id"
                    :wallpaper="wallpaper"
                    :index="index"
                    view-mode="grid"
                    :aspect-ratio="getAspectRatio(wallpaper)"
                    :action-mode="libraryCardActionMode"
                    :liked="interactionStore.isLiked(wallpaper.filename || wallpaper.id, wallpaper._series)"
                    :collected="interactionStore.isCollected(wallpaper.filename || wallpaper.id, wallpaper._series)"
                    :is-authenticated="true"
                    @click="handleSelectWallpaper"
                    @toggle-like="interactionStore.handleToggleLike(wallpaper.filename || wallpaper.id, wallpaper._series)"
                    @toggle-collect="interactionStore.handleToggleCollect(wallpaper.filename || wallpaper.id, wallpaper._series)"
                  />
                </div>

                <!-- 空状态 -->
                <div v-else class="library-empty-state">
                  <div class="library-empty-state__icon">
                    <svg v-if="activeTab === 'collections'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
                    </svg>
                  </div>
                  <h3>
                    {{ activeSeries === 'all'
                      ? `还没有${activeTab === 'likes' ? '喜欢' : '收藏'}的壁纸`
                      : `${seriesOptions.find(o => o.id === activeSeries)?.name || ''}分区暂无内容` }}
                  </h3>
                  <p>
                    {{ activeTab === 'likes'
                      ? '浏览主页壁纸时，点击爱心按钮即可添加到这里。'
                      : '浏览主页壁纸时，点击星标按钮即可收藏到这里。' }}
                  </p>
                  <RouterLink class="library-empty-state__action" to="/">
                    去发现壁纸
                  </RouterLink>
                </div>
              </div>
            </section>
          </section>
        </template>
      </section>
    </div>

    <!-- 壁纸详情弹窗（复用主页弹窗） -->
    <HomeModalHost
      :wallpaper="selectedWallpaper"
      :is-open="isModalOpen"
      :use-portrait-modal="usePortraitModal"
      :show-mobile-series-notice="false"
      @close="handleCloseModal"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/styles/variables' as *;

.library-page {
  padding: 16px 0 12px;
  background: transparent;
}

.library-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.library-hero {
  max-width: 760px;

  h1 {
    margin: 10px 0 12px;
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1.04;
    letter-spacing: -0.04em;
    color: #0f172a;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    color: #526277;
    font-size: 16px;
    line-height: 1.8;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.library-eyebrow,
.library-content-card__eyebrow {
  display: inline-flex;
  align-items: center;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;

  [data-theme='dark'] & {
    color: #93c5fd;
  }
}

// ========================================
// 布局：侧边栏 + 主内容
// ========================================

.library-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;

  @include desktop-up {
    flex-direction: row;
  }
}

.library-sidebar {
  flex-shrink: 0;

  @include desktop-up {
    width: 300px;
    position: sticky;
    top: calc(var(--header-height, 64px) + 16px);
    align-self: flex-start;
  }
}

.library-main {
  flex: 1;
  min-width: 0;
}

// ========================================
// 卡片通用样式
// ========================================

.library-profile-card,
.library-content-card,
.library-state-card {
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.88)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.05) 52%, rgba(255, 255, 255, 0));
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(18px);

  [data-theme='dark'] & {
    border-color: rgba(148, 163, 184, 0.16);
    background:
      linear-gradient(180deg, rgba(8, 15, 28, 0.92), rgba(8, 15, 28, 0.86)),
      linear-gradient(140deg, rgba(59, 130, 246, 0.14), rgba(14, 165, 233, 0.08) 52%, rgba(2, 6, 23, 0));
    box-shadow:
      0 26px 72px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
}

// ========================================
// 侧边栏 Profile Card
// ========================================

.library-profile-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
}

.library-profile-card__avatar-wrap {
  display: flex;
  justify-content: flex-start;
}

:deep(.library-profile-card__avatar),
:deep(.library-profile-card__avatar-image) {
  width: 76px;
  height: 76px;
}

:deep(.library-profile-card__avatar) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  background: var(--avatar-accent-end, #2563eb);
  box-shadow: 0 18px 36px var(--avatar-accent-shadow, rgba(37, 99, 235, 0.24));
}

:deep(.library-profile-card__avatar-image) {
  object-fit: cover;
  border-radius: 26px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.14);
}

.library-profile-card__copy {
  h2 {
    margin: 0;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.08;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    margin-top: 10px;
    color: #64748b;
    line-height: 1.7;
    word-break: break-word;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.library-profile-card__stats {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, 1fr);
}

.library-profile-card__stat {
  padding: 12px 10px;
  border-radius: 16px;
  background: rgba(239, 246, 255, 0.72);
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  text-align: center;

  [data-theme='dark'] & {
    background: rgba(11, 22, 41, 0.82);
    border-color: rgba(96, 165, 250, 0.18);
  }

  span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;

    [data-theme='dark'] & {
      color: #94a3b8;
    }

    svg {
      width: 12px;
      height: 12px;
    }
  }

  strong {
    color: #0f172a;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.2;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  &--like span svg {
    color: #ef4444;
  }

  &--collect span svg {
    color: #f59e0b;
  }
}

.library-profile-card__link,
.library-primary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 16px;
  color: white;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid transparent;
  text-decoration: none;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.22);
  transition:
    transform 220ms ease,
    box-shadow 220ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 38px rgba(37, 99, 235, 0.28);
  }
}

// ========================================
// 主内容区
// ========================================

.library-content-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 22px;
}

.library-content-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 8px 0 0;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.12;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }
}

.library-content-card__count {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  color: #eff6ff;
  font-size: 12px;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: 1px solid transparent;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);

  [data-theme='dark'] & {
    background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
  }
}

// ========================================
// Tabs（保持原有风格）
// ========================================

.library-tabs {
  :deep(.el-tabs__nav-wrap) {
    padding: 6px 8px;
    border-radius: 18px;
    background: rgba(239, 246, 255, 0.78);
    border: 1px solid rgba(96, 165, 250, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.48);

    [data-theme='dark'] & {
      background: rgba(10, 19, 34, 0.84);
      border-color: rgba(96, 165, 250, 0.16);
    }
  }

  :deep(.el-tabs__nav-wrap::after) {
    background: transparent;
  }

  :deep(.el-tabs__active-bar) {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    height: calc(100% - 12px);
    border-radius: 14px;
    top: 6px;
    bottom: auto;
    box-shadow: 0 12px 22px rgba(37, 99, 235, 0.14);
  }

  :deep(.el-tabs__item) {
    position: relative;
    z-index: 1;
    color: #64748b;
    height: 40px;
    line-height: 40px;
    font-weight: 600;
    border-radius: 14px;

    [data-theme='dark'] & {
      color: #94a3b8;
    }
  }

  :deep(.el-tabs__item:hover) {
    color: #0f172a;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  :deep(.el-tabs__item.is-active) {
    color: #eff6ff;

    [data-theme='dark'] & {
      color: #eff6ff;
    }
  }
}

// ========================================
// 系列筛选胶囊
// ========================================

.series-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.series-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 999px;
  background: rgba(239, 246, 255, 0.6);
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 260ms cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme='dark'] & {
    background: rgba(11, 22, 41, 0.7);
    border-color: rgba(96, 165, 250, 0.18);
    color: #94a3b8;
  }

  &:hover {
    background: rgba(219, 234, 254, 0.8);
    border-color: rgba(96, 165, 250, 0.3);
    color: #1e40af;

    [data-theme='dark'] & {
      background: rgba(30, 58, 138, 0.3);
      color: #bfdbfe;
    }
  }

  &.is-active {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    border-color: transparent;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.24);

    [data-theme='dark'] & {
      background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
      color: white;
    }
  }
}

.series-pill__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.08);
  color: inherit;

  .is-active & {
    background: rgba(255, 255, 255, 0.25);
    color: white;
  }

  [data-theme='dark'] & {
    background: rgba(255, 255, 255, 0.08);
  }
}

// ========================================
// 壁纸网格
// ========================================

.library-wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;

  @include tablet-up {
    grid-template-columns: repeat(3, 1fr);
  }

  @include desktop-up {
    grid-template-columns: repeat(3, 1fr);
  }

  @include large-desktop-up {
    grid-template-columns: repeat(4, 1fr);
  }

  // 竖屏壁纸（手机）- 更多列
  &.is-portrait {
    grid-template-columns: repeat(3, 1fr);

    @include tablet-up {
      grid-template-columns: repeat(4, 1fr);
    }

    @include desktop-up {
      grid-template-columns: repeat(4, 1fr);
    }

    @include large-desktop-up {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  // 正方形壁纸（头像）
  &.is-square {
    grid-template-columns: repeat(3, 1fr);

    @include tablet-up {
      grid-template-columns: repeat(4, 1fr);
    }

    @include desktop-up {
      grid-template-columns: repeat(5, 1fr);
    }

    @include large-desktop-up {
      grid-template-columns: repeat(6, 1fr);
    }
  }
}

.library-wallpaper-grid--masonry {
  display: block;
  column-count: 2;
  column-gap: 14px;

  @include tablet-up {
    column-count: 3;
  }

  @include desktop-up {
    column-count: 4;
  }

  @include large-desktop-up {
    column-count: 5;
  }

  :deep(.wallpaper-card) {
    width: 100%;
    margin-bottom: 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
}

// ========================================
// 加载状态
// ========================================

.library-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 12px;
  color: #64748b;
  font-size: 14px;

  [data-theme='dark'] & {
    color: #94a3b8;
  }
}

.library-loading__spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ========================================
// 空状态
// ========================================

.library-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 28px 20px;
  border-radius: 24px;
  border: 1px dashed rgba(96, 165, 250, 0.22);
  background: radial-gradient(circle at top, rgba(37, 99, 235, 0.1), transparent 42%), rgba(248, 251, 255, 0.82);
  text-align: center;

  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.18);
    background: radial-gradient(circle at top, rgba(59, 130, 246, 0.16), transparent 42%), rgba(10, 19, 34, 0.82);
  }

  h3 {
    margin: 18px 0 10px;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.16;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    max-width: 420px;
    color: #64748b;
    line-height: 1.8;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.library-empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 28px;
  color: #1d4ed8;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92)),
    linear-gradient(140deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.04));
  border: 1px solid rgba(96, 165, 250, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 14px 28px rgba(37, 99, 235, 0.08);

  [data-theme='dark'] & {
    color: #bfdbfe;
    background:
      linear-gradient(180deg, rgba(20, 34, 60, 0.96), rgba(12, 21, 39, 0.92)),
      linear-gradient(140deg, rgba(96, 165, 250, 0.14), rgba(14, 165, 233, 0.08));
    border-color: rgba(96, 165, 250, 0.16);
  }

  svg {
    width: 34px;
    height: 34px;
  }
}

.library-empty-state__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  margin-top: 16px;
  padding: 0 20px;
  border-radius: 14px;
  color: white;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
  transition:
    transform 220ms ease,
    box-shadow 220ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(37, 99, 235, 0.28);
  }
}

// ========================================
// 状态卡片
// ========================================

.library-state-card {
  padding: 42px 24px;
  text-align: center;

  h2 {
    margin: 18px 0 10px;
    color: #0f172a;
    font-size: 26px;

    [data-theme='dark'] & {
      color: #f8fafc;
    }
  }

  p {
    max-width: 520px;
    margin: 0 auto;
    color: #64748b;
    line-height: 1.8;

    [data-theme='dark'] & {
      color: #cbd5e1;
    }
  }
}

.library-state-card__icon {
  width: 68px;
  height: 68px;
  margin: 0 auto;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(37, 99, 235, 0.18));

  &.is-unavailable {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(249, 115, 22, 0.18));
  }
}

// ========================================
// 移动端适配
// ========================================

@media (max-width: 767px) {
  .library-page {
    padding: 14px 0 12px;
  }

  .library-profile-card {
    padding: 18px;
  }

  .library-profile-card__stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .library-content-card {
    padding: 16px;
  }

  .library-content-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .series-filter-pills {
    gap: 6px;
  }

  .series-pill {
    padding: 6px 12px;
    font-size: 12px;
  }

  .library-wallpaper-grid {
    gap: 8px;
  }

  .library-wallpaper-grid--masonry {
    column-gap: 8px;

    :deep(.wallpaper-card) {
      margin-bottom: 8px;
    }
  }

  .library-empty-state {
    min-height: 260px;
  }
}
</style>
