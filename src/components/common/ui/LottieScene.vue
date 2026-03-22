<script setup>
import { DotLottie } from '@lottiefiles/dotlottie-web'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  autoplay: {
    type: Boolean,
    default: true,
  },
  loop: {
    type: Boolean,
    default: true,
  },
  speed: {
    type: Number,
    default: 1,
  },
  fit: {
    type: String,
    default: 'contain',
  },
  pauseWhenHidden: {
    type: Boolean,
    default: true,
  },
  disableMotionOnReduce: {
    type: Boolean,
    default: true,
  },
})

const rootRef = ref(null)
const canvasRef = ref(null)
const hasError = ref(false)
const prefersReducedMotion = ref(false)

let player = null
let resizeObserver = null
let intersectionObserver = null
let mediaQueryList = null

const shouldAnimate = computed(() => !props.disableMotionOnReduce || !prefersReducedMotion.value)

function applyPlaybackPreferences() {
  if (!player) {
    return
  }

  player.setSpeed(props.speed)
  player.setLoop(props.loop && shouldAnimate.value)

  if (props.autoplay && shouldAnimate.value) {
    player.play()
  }
  else {
    player.pause()
    player.setFrame(0)
  }
}

function handleVisibilityChange(entries) {
  if (!props.pauseWhenHidden || !player) {
    return
  }

  const [entry] = entries
  if (entry?.isIntersecting) {
    player.unfreeze()
    if (props.autoplay && shouldAnimate.value) {
      player.play()
    }
    return
  }

  player.freeze()
}

function destroyPlayer() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (player) {
    player.destroy()
    player = null
  }
}

function initPlayer() {
  if (!canvasRef.value || !props.src) {
    return
  }

  destroyPlayer()
  hasError.value = false

  player = new DotLottie({
    canvas: canvasRef.value,
    src: props.src,
    autoplay: props.autoplay && shouldAnimate.value,
    loop: props.loop && shouldAnimate.value,
    speed: props.speed,
    layout: {
      fit: props.fit,
      align: [0.5, 0.5],
    },
    renderConfig: {
      autoResize: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      freezeOnOffscreen: false,
    },
  })

  player.addEventListener('loadError', () => {
    hasError.value = true
  })
  player.addEventListener('ready', () => {
    hasError.value = false
    player?.resize()
    applyPlaybackPreferences()
  })

  resizeObserver = new ResizeObserver(() => {
    player?.resize()
  })
  resizeObserver.observe(rootRef.value)

  if (props.pauseWhenHidden) {
    intersectionObserver = new IntersectionObserver(handleVisibilityChange, {
      threshold: 0.12,
    })
    intersectionObserver.observe(rootRef.value)
  }
}

function updateReducedMotionPreference(event) {
  prefersReducedMotion.value = event.matches
  applyPlaybackPreferences()
}

onMounted(() => {
  mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mediaQueryList.matches
  mediaQueryList.addEventListener('change', updateReducedMotionPreference)

  initPlayer()
})

watch(
  () => props.src,
  () => {
    initPlayer()
  },
)

watch(
  () => [props.loop, props.autoplay, props.speed],
  () => {
    applyPlaybackPreferences()
  },
)

onBeforeUnmount(() => {
  if (mediaQueryList) {
    mediaQueryList.removeEventListener('change', updateReducedMotionPreference)
    mediaQueryList = null
  }

  destroyPlayer()
})
</script>

<template>
  <div
    ref="rootRef"
    class="lottie-scene"
    :class="{ 'lottie-scene--error': hasError }"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="lottie-scene__canvas" />
  </div>
</template>

<style lang="scss" scoped>
.lottie-scene {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}

.lottie-scene__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.lottie-scene--error {
  opacity: 0;
}
</style>
