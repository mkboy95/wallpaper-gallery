<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  eyeColor: {
    type: String,
    default: 'white',
  },
  forceLookX: {
    type: Number,
    default: undefined,
  },
  forceLookY: {
    type: Number,
    default: undefined,
  },
  isBlinking: {
    type: Boolean,
    default: false,
  },
  maxDistance: {
    type: Number,
    default: 10,
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
  pupilSize: {
    type: Number,
    default: 16,
  },
  size: {
    type: Number,
    default: 48,
  },
})

const eyeRef = ref(null)

const pupilOffset = computed(() => {
  if (Number.isFinite(props.forceLookX) && Number.isFinite(props.forceLookY)) {
    return {
      x: props.forceLookX,
      y: props.forceLookY,
    }
  }

  if (!eyeRef.value) {
    return {
      x: 0,
      y: 0,
    }
  }

  const rect = eyeRef.value.getBoundingClientRect()
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

const eyeStyle = computed(() => ({
  width: `${props.size}px`,
  height: props.isBlinking ? '2px' : `${props.size}px`,
  backgroundColor: props.eyeColor,
}))

const pupilStyle = computed(() => ({
  width: `${props.pupilSize}px`,
  height: `${props.pupilSize}px`,
  backgroundColor: props.pupilColor,
  transform: `translate(${pupilOffset.value.x}px, ${pupilOffset.value.y}px)`,
}))
</script>

<template>
  <div ref="eyeRef" class="login-eye" :style="eyeStyle">
    <div v-if="!isBlinking" class="login-eye__pupil" :style="pupilStyle" />
  </div>
</template>

<style scoped>
.login-eye {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  transition: all 150ms ease;
}

.login-eye__pupil {
  border-radius: 50%;
  transition: transform 100ms ease-out;
}
</style>
