<script setup>
import LottieScene from '@/components/common/ui/LottieScene.vue'

defineProps({
  alternativeSeries: {
    type: Array,
    default: () => [],
  },
  currentSeries: {
    type: String,
    default: '',
  },
  currentSeriesName: {
    type: String,
    default: '壁纸',
  },
  type: {
    type: String,
    default: 'no-series-data',
  },
})

const emit = defineEmits(['navigate', 'resetFilters'])
</script>

<template>
  <div v-if="type === 'no-series-data'" class="grid-empty series-empty">
    <div class="empty-icon">
      <LottieScene
        class="empty-icon__lottie"
        src="/lottie/Empty box.lottie"
        :autoplay="true"
        :loop="true"
        :speed="1"
      />
    </div>
    <h3>暂无{{ currentSeriesName }}</h3>
    <p>该分类暂时没有内容，敬请期待~</p>
    <div v-if="alternativeSeries.length > 0" class="empty-actions">
      <button
        v-for="series in alternativeSeries"
        :key="series.id"
        class="action-btn"
        @click="emit('navigate', series.id)"
      >
        查看{{ series.name }}
      </button>
    </div>
  </div>

  <div v-else class="grid-empty filter-empty">
    <div class="empty-icon">
      <LottieScene
        class="empty-icon__lottie"
        src="/lottie/Empty box.lottie"
        :autoplay="true"
        :loop="true"
        :speed="1"
      />
    </div>
    <h3>没有找到匹配的壁纸</h3>
    <p>尝试调整搜索条件或筛选器</p>
    <div class="empty-actions">
      <button class="action-btn primary" @click="emit('resetFilters')">
        清除筛选条件
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;
  animation: fadeIn 0.5s ease;

  .empty-icon {
    position: relative;
    width: 168px;
    height: 168px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 0;
    margin-bottom: $spacing-md;

    .empty-icon__lottie {
      position: absolute;
      inset: 0;
      opacity: 1;
      pointer-events: none;
    }
  }

  h3 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    margin-bottom: $spacing-lg;
  }

  &.series-empty {
    h3 {
      margin-top: 2px;
    }
  }

  &.filter-empty {
    .empty-icon {
      .empty-icon__lottie {
        opacity: 0.96;
      }
    }
  }
}

@include mobile-only {
  .grid-empty {
    padding: $spacing-xl $spacing-md;

    .empty-icon {
      width: 144px;
      height: 144px;
    }
  }
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  justify-content: center;
  margin-top: $spacing-sm;
}

.action-btn {
  padding: 10px 20px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  &:active {
    transform: scale(0.95);
  }

  &.primary {
    color: white;
    background: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
      color: white;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
