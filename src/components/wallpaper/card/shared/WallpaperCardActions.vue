<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  liked: {
    type: Boolean,
    default: false,
  },
  collected: {
    type: Boolean,
    default: false,
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  actionMode: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits(['toggleLike', 'toggleCollect'])

const likeAnimating = ref(false)
const collectAnimating = ref(false)
const showCollectAction = computed(() => ['all', 'collect-only'].includes(props.actionMode))
const showLikeAction = computed(() => ['all', 'like-only'].includes(props.actionMode))

function handleLike(e) {
  e.stopPropagation()
  if (likeAnimating.value)
    return

  likeAnimating.value = true
  emit('toggleLike')

  setTimeout(() => {
    likeAnimating.value = false
  }, 500)
}

function handleCollect(e) {
  e.stopPropagation()
  if (collectAnimating.value)
    return

  collectAnimating.value = true
  emit('toggleCollect')

  setTimeout(() => {
    collectAnimating.value = false
  }, 500)
}
</script>

<template>
  <div
    v-if="showCollectAction || showLikeAction"
    class="card-actions"
    :class="{ 'card-actions--compact': compact }"
  >
    <button
      v-if="showCollectAction"
      class="action-btn action-btn--collect"
      :class="{
        'is-active': collected,
        'is-animating': collectAnimating,
        'is-unauth': !isAuthenticated,
      }"
      type="button"
      :aria-pressed="collected"
      :aria-label="collected ? '取消收藏' : '收藏壁纸'"
      :title="collected ? '取消收藏' : '收藏'"
      @click="handleCollect"
    >
      <svg viewBox="0 0 24 24" :fill="collected ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>

    <button
      v-if="showLikeAction"
      class="action-btn action-btn--like"
      :class="{
        'is-active': liked,
        'is-animating': likeAnimating,
        'is-unauth': !isAuthenticated,
      }"
      type="button"
      :aria-pressed="liked"
      :aria-label="liked ? '取消喜欢' : '喜欢壁纸'"
      :title="liked ? '取消喜欢' : '喜欢'"
      @click="handleLike"
    >
      <svg viewBox="0 0 24 24" :fill="liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <path d="m12 21-1.45-1.32C5.4 15.03 2 11.95 2 8.5 2 5.42 4.42 3 7.5 3A5.3 5.3 0 0 1 12 5.09 5.3 5.3 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.45-3.4 6.53-8.55 11.18z" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.88);
  transition:
    transform 180ms ease,
    background 200ms ease,
    color 200ms ease,
    box-shadow 200ms ease;

  svg {
    width: 16px;
    height: 16px;
    transition: transform 200ms ease;
  }

  &:hover {
    transform: scale(1.12);
    background: rgba(0, 0, 0, 0.5);
  }

  &:active {
    transform: scale(0.92);
  }

  // 未登录状态 - 点击时抖动提示
  &.is-unauth:active {
    animation: shake 400ms ease;
  }

  // ---- 喜欢按钮激活态 ----
  &--like.is-active {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.22);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);

    &:hover {
      background: rgba(239, 68, 68, 0.32);
    }
  }

  &--like.is-animating {
    animation: heartbeat 500ms ease;

    svg {
      animation: heartPulse 500ms ease;
    }
  }

  // ---- 收藏按钮激活态 ----
  &--collect.is-active {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.22);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);

    &:hover {
      background: rgba(245, 158, 11, 0.32);
    }
  }

  &--collect.is-animating {
    animation: starPop 500ms ease;

    svg {
      animation: starSpin 500ms ease;
    }
  }
}

.card-actions--compact .action-btn {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(6, 17, 34, 0.82), rgba(10, 25, 47, 0.74));
  border: 1px solid rgba(191, 219, 254, 0.18);
  box-shadow:
    0 12px 20px rgba(2, 8, 23, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.96);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: linear-gradient(180deg, rgba(10, 24, 45, 0.92), rgba(16, 32, 58, 0.82));
  }
}

.card-actions--compact .action-btn--like.is-active {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.92), rgba(190, 24, 93, 0.88));
  color: #fff6f6;
  box-shadow: 0 14px 26px rgba(239, 68, 68, 0.3);
}

.card-actions--compact .action-btn--collect.is-active {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.96), rgba(217, 119, 6, 0.9));
  color: #fffaf0;
  box-shadow: 0 14px 26px rgba(245, 158, 11, 0.32);
}

// ========================================
// 微交互动画
// ========================================

@keyframes heartbeat {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(0.95);
  }
  75% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes heartPulse {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.25);
  }
  60% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes starPop {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.25) rotate(12deg);
  }
  60% {
    transform: scale(0.95) rotate(-6deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes starSpin {
  0% {
    transform: rotate(0deg) scale(1);
  }
  40% {
    transform: rotate(72deg) scale(1.2);
  }
  100% {
    transform: rotate(0deg) scale(1);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-3px);
  }
  40% {
    transform: translateX(3px);
  }
  60% {
    transform: translateX(-2px);
  }
  80% {
    transform: translateX(2px);
  }
}
</style>
