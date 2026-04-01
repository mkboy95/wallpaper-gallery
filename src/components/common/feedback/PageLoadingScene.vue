<script setup>
import LottieScene from '@/components/common/ui/LottieScene.vue'

defineProps({
  text: {
    type: String,
    default: '请稍候...',
  },
  title: {
    type: String,
    default: '页面加载中',
  },
})

const loadingAnimationSrc = `${import.meta.env.BASE_URL}lottie/Loading%20animation%20blue.lottie`
</script>

<template>
  <div class="page-loading-scene">
    <div class="page-loading-scene__shell">
      <div class="page-loading-scene__visual">
        <LottieScene
          :src="loadingAnimationSrc"
          :speed="0.95"
          fit="contain"
        />
      </div>
      <p class="page-loading-scene__title">
        {{ title }}
      </p>
      <p class="page-loading-scene__text">
        {{ text }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-loading-scene {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(320px, 44vh, 460px);
  padding: clamp(20px, 5vw, 40px) 0;
}

.page-loading-scene__shell {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.page-loading-scene__visual {
  width: clamp(140px, 20vw, 210px);
  aspect-ratio: 1;
  filter: drop-shadow(0 16px 36px rgba(37, 99, 235, 0.14));
}

.page-loading-scene__title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: clamp(18px, 2vw, 22px);
  font-weight: 600;
}

.page-loading-scene__text {
  margin: 0;
  max-width: 28ch;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
}
</style>
