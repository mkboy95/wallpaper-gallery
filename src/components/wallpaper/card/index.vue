<script setup>
import { gsap } from 'gsap'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { buildProxyImageUrl, buildRawImageUrl, formatBingDate, formatFileSize, formatRelativeTime, getDisplayFilename, highlightText } from '@/utils/common/format'
import WallpaperCardInfo from './shared/WallpaperCardInfo.vue'
import WallpaperCardMedia from './shared/WallpaperCardMedia.vue'

const props = defineProps({
  wallpaper: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    default: 0,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  viewMode: {
    type: String,
    default: 'grid',
  },
  aspectRatio: {
    type: String,
    default: '16/10',
  },
  popularRank: {
    type: Number,
    default: 0,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  liked: {
    type: Boolean,
    default: false,
  },
  collected: {
    type: Boolean,
    default: false,
  },
  actionMode: {
    type: String,
    default: 'all',
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click', 'imageLoad', 'toggleLike', 'toggleCollect'])
const { isMobile } = useDevice()

const cardRef = ref(null)
const imageRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const fallbackStage = ref('none')

let cacheCheckTimer = null
let gsapTargets = []

const primaryImageUrl = computed(() => props.wallpaper.previewUrl || props.wallpaper.thumbnailUrl || props.wallpaper.url)

const thumbnailUrl = computed(() => {
  if (fallbackStage.value === 'raw') {
    return buildRawImageUrl(primaryImageUrl.value)
  }

  if (fallbackStage.value === 'proxy') {
    return buildProxyImageUrl(primaryImageUrl.value)
  }

  return primaryImageUrl.value
})

watch(() => props.wallpaper?.id, () => {
  fallbackStage.value = 'none'
  imageLoaded.value = false
  imageError.value = false
})

onMounted(() => {
  cacheCheckTimer = setTimeout(() => {
    if (imageRef.value && imageRef.value.complete && imageRef.value.naturalWidth > 0) {
      imageLoaded.value = true
    }
  }, 0)
})

onUnmounted(() => {
  if (cacheCheckTimer) {
    clearTimeout(cacheCheckTimer)
    cacheCheckTimer = null
  }

  if (gsapTargets.length > 0) {
    gsapTargets.forEach(target => gsap.killTweensOf(target))
    gsapTargets = []
  }

  if (cardRef.value) {
    gsap.killTweensOf(cardRef.value)
  }
})

const formattedSize = computed(() => formatFileSize(props.wallpaper.size))
const fileFormat = computed(() => props.wallpaper.filename.split('.').pop()?.toUpperCase() || '')
const relativeTime = computed(() => formatRelativeTime(props.wallpaper.createdAt))
const displayFilename = computed(() => {
  if (props.wallpaper.displayTitle) {
    return props.wallpaper.displayTitle.replace(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif|ico|heic|heif)$/i, '')
  }
  return getDisplayFilename(props.wallpaper.filename)
})
const aiKeywords = computed(() => props.wallpaper.keywords?.slice(0, 3) || [])
const highlightedFilename = computed(() => highlightText(displayFilename.value, props.searchQuery))
const categoryDisplay = computed(() => {
  const { category, subcategory } = props.wallpaper
  if (!category)
    return ''
  return subcategory ? `${category} / ${subcategory}` : category
})

const isBingWallpaper = computed(() => props.wallpaper?.isBing === true)
const bingTitle = computed(() => props.wallpaper?.title || '')

const imageAlt = computed(() => {
  if (isBingWallpaper.value && props.wallpaper.title)
    return `${props.wallpaper.title} - Bing每日壁纸`
  const parts = [displayFilename.value]
  if (categoryDisplay.value)
    parts.push(categoryDisplay.value)
  if (aiKeywords.value.length > 0)
    parts.push(aiKeywords.value.join(' '))
  return `${parts.join(' - ')} 高清壁纸`
})
const bingDate = computed(() => props.wallpaper?.date ? formatBingDate(props.wallpaper.date) : '')
const bingCopyright = computed(() => {
  if (!props.wallpaper?.copyright)
    return ''
  const copyright = props.wallpaper.copyright
  const parenIndex = copyright.indexOf('(')
  return parenIndex > 0 ? copyright.substring(0, parenIndex).trim() : copyright
})

const normalizedAspectRatio = computed(() => props.aspectRatio.replace('/', ' / '))
const cardImageStyle = computed(() => ({ aspectRatio: normalizedAspectRatio.value }))

const listImageStyle = computed(() => {
  if (isMobile.value) {
    return {
      width: '100px',
      height: '100px',
      aspectRatio: '1 / 1',
    }
  }
  const [w, h] = props.aspectRatio.split('/').map(Number)
  const ratio = w / h
  const baseWidth = ratio >= 1 ? 200 : 120
  return {
    width: `${baseWidth}px`,
    aspectRatio: normalizedAspectRatio.value,
  }
})

function handleImageLoad() {
  imageLoaded.value = true
  imageError.value = false
  emit('imageLoad')
}

function handleImageError() {
  if (fallbackStage.value === 'none') {
    fallbackStage.value = 'raw'
    imageLoaded.value = false
  }
  else if (fallbackStage.value === 'raw') {
    fallbackStage.value = 'proxy'
    imageLoaded.value = false
  }
  else {
    imageError.value = true
    imageLoaded.value = true
  }
}

function handleClick() {
  emit('click', props.wallpaper)
}

function handleMouseEnter(e) {
  if (isMobile.value)
    return

  const card = e.currentTarget
  const overlay = card.querySelector('.card-overlay')
  const img = card.querySelector('.card-image img')

  gsapTargets = [card, overlay, img].filter(Boolean)

  gsap.to(card, {
    y: -10,
    duration: 0.3,
    ease: 'power2.out',
  })

  gsap.to(overlay, {
    opacity: 1,
    duration: 0.3,
  })

  if (img) {
    gsap.to(img, {
      scale: 1.1,
      duration: 0.4,
      ease: 'power2.out',
    })
  }
}

function handleMouseLeave(e) {
  if (isMobile.value)
    return

  const card = e.currentTarget
  const overlay = card.querySelector('.card-overlay')
  const img = card.querySelector('.card-image img')

  gsap.to(card, {
    y: 0,
    duration: 0.3,
    ease: 'power2.out',
    clearProps: 'transform',
  })

  gsap.to(overlay, {
    opacity: 0,
    duration: 0.3,
  })

  if (img) {
    gsap.to(img, {
      scale: 1,
      duration: 0.4,
      ease: 'power2.out',
      clearProps: 'transform',
    })
  }
}
</script>

<template>
  <div
    ref="cardRef"
    class="wallpaper-card"
    :class="`view-${viewMode}`"
    :data-flip-id="wallpaper.id"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <WallpaperCardMedia
      :bing-date="bingDate"
      :category-display="categoryDisplay"
      :collected="collected"
      :action-mode="actionMode"
      :image-alt="imageAlt"
      :image-error="imageError"
      :image-loaded="imageLoaded"
      :image-ref="imageRef"
      :index="index"
      :is-authenticated="isAuthenticated"
      :is-bing-wallpaper="isBingWallpaper"
      :is-mobile="isMobile"
      :liked="liked"
      :popular-rank="popularRank"
      :style="viewMode === 'list' ? listImageStyle : cardImageStyle"
      :thumbnail-url="thumbnailUrl"
      :view-mode="viewMode"
      @load="handleImageLoad"
      @error="handleImageError"
      @toggle-like="emit('toggleLike')"
      @toggle-collect="emit('toggleCollect')"
    />

    <WallpaperCardInfo
      :ai-keywords="aiKeywords"
      :bing-copyright="bingCopyright"
      :bing-date="bingDate"
      :bing-title="bingTitle"
      :category-display="categoryDisplay"
      :display-filename="displayFilename"
      :download-count="downloadCount"
      :file-format="fileFormat"
      :formatted-size="formattedSize"
      :highlighted-filename="highlightedFilename"
      :is-bing-wallpaper="isBingWallpaper"
      :relative-time="relativeTime"
      :view-count="viewCount"
      :view-mode="viewMode"
      :wallpaper-copyright="wallpaper.copyright || ''"
    />
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-card {
  position: relative;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.86)),
    radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.18), transparent 58%),
    radial-gradient(circle at bottom right, rgba(var(--color-accent-secondary-rgb), 0.12), transparent 56%);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow:
    0 14px 30px rgba(37, 99, 235, 0.08),
    0 24px 48px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  backface-visibility: hidden;
  transition:
    background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &::before {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0));
    pointer-events: none;
    z-index: 0;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    z-index: 0;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  > * {
    position: relative;
    z-index: 1;
  }

  [data-theme='dark'] & {
    background:
      linear-gradient(180deg, rgba(9, 16, 30, 0.98), rgba(6, 11, 22, 0.96)),
      linear-gradient(145deg, rgba(96, 165, 250, 0.14), rgba(14, 165, 233, 0.06) 42%, rgba(2, 6, 23, 0) 68%);
    border-color: rgba(96, 165, 250, 0.22);
    box-shadow:
      0 22px 44px rgba(2, 8, 23, 0.42),
      0 10px 24px rgba(37, 99, 235, 0.1),
      inset 0 1px 0 rgba(191, 219, 254, 0.09),
      inset 0 -1px 0 rgba(15, 23, 42, 0.52);

    &::before {
      background: linear-gradient(180deg, rgba(191, 219, 254, 0.1), rgba(255, 255, 255, 0));
    }

    &::after {
      opacity: 1;
      background:
        radial-gradient(circle at 14% 12%, rgba(96, 165, 250, 0.16), transparent 24%),
        radial-gradient(circle at 84% 88%, rgba(14, 165, 233, 0.12), transparent 26%);
    }
  }

  &:hover {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(219, 234, 254, 0.9)),
      radial-gradient(circle at top left, rgba(var(--color-accent-rgb), 0.24), transparent 52%),
      radial-gradient(circle at bottom right, rgba(var(--color-accent-secondary-rgb), 0.16), transparent 52%);
    border-color: var(--accent-border-strong);
    box-shadow:
      0 18px 36px rgba(37, 99, 235, 0.12),
      0 28px 56px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.66);
    transform: translateY(-4px);

    [data-theme='dark'] & {
      background:
        linear-gradient(180deg, rgba(11, 20, 36, 0.99), rgba(8, 14, 27, 0.96)),
        linear-gradient(145deg, rgba(96, 165, 250, 0.2), rgba(14, 165, 233, 0.1) 40%, rgba(2, 6, 23, 0) 66%);
      border-color: rgba(147, 197, 253, 0.26);
      box-shadow:
        0 28px 54px rgba(2, 8, 23, 0.46),
        0 14px 32px rgba(37, 99, 235, 0.14),
        inset 0 1px 0 rgba(191, 219, 254, 0.12),
        inset 0 -1px 0 rgba(15, 23, 42, 0.56);
    }
  }

  @include mobile-only {
    &.view-grid {
      border-radius: var(--radius-sm);
      box-shadow:
        0 10px 20px rgba(15, 23, 42, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.44);

      [data-theme='dark'] & {
        box-shadow:
          0 14px 26px rgba(2, 8, 23, 0.3),
          inset 0 1px 0 rgba(191, 219, 254, 0.06);
      }
    }
  }
}

.wallpaper-card.view-list {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
