<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  forceLookX: {
    type: Number,
    default: undefined,
  },
  forceLookY: {
    type: Number,
    default: undefined,
  },
  maxDistance: {
    type: Number,
    default: 5,
  },
  mouseX: {
    type: Number,
    default: 0,
  },
  mouseY: {
    type: Number,
    default: 0,
  },
  pupilColor: {
    type: String,
    default: '#2D2D2D',
  },
  size: {
    type: Number,
    default: 12,
  },
})

const pupilRef = ref(null)

const pupilOffset = computed(() => {
  if (Number.isFinite(props.forceLookX) && Number.isFinite(props.forceLookY)) {
    return {
      x: props.forceLookX,
      y: props.forceLookY,
    }
  }

  if (!pupilRef.value) {
    return {
      x: 0,
      y: 0,
    }
  }

  const rect = pupilRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const deltaX = props.mouseX - centerX
  const deltaY = props.mouseY - centerY
  const distance = Math.min(Math.hypot(deltaX, deltaY), props.maxDistance)
  const angle = Math.atan2(deltaY, deltaX)

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  }
})

const pupilStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: props.pupilColor,
  transform: `translate(${pupilOffset.value.x}px, ${pupilOffset.value.y}px)`,
}))
</script>

<template>
  <div ref="pupilRef" class="login-pupil" :style="pupilStyle" />
</template>

<style scoped>
.login-pupil {
  border-radius: 50%;
  transition: transform 100ms ease-out;
}
</style>
