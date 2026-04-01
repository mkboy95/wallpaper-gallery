<script setup>
defineProps({
  cropInfo: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  exportFormatLabel: {
    type: String,
    default: '',
  },
  exportQualityLabel: {
    type: String,
    default: '',
  },
  exportScaleHint: {
    type: String,
    default: '',
  },
  finalExportSize: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  originalResolution: {
    type: Object,
    default: null,
  },
  selectedBatchCount: {
    type: Number,
    default: 0,
  },
})
</script>

<template>
  <div class="panel-section panel-section--info">
    <div class="size-info">
      <div class="size-row">
        <span class="size-label">裁剪尺寸</span>
        <span class="size-value highlight">{{ cropInfo.width || '—' }} × {{ cropInfo.height || '—' }}</span>
      </div>
      <div class="size-row">
        <span class="size-label">单张导出</span>
        <span class="size-value">{{ finalExportSize.width || '—' }} × {{ finalExportSize.height || '—' }}</span>
      </div>
      <div v-if="originalResolution" class="size-row">
        <span class="size-label">原图尺寸</span>
        <span class="size-value">{{ originalResolution.width }} × {{ originalResolution.height }}</span>
      </div>
      <div class="size-row">
        <span class="size-label">输出格式</span>
        <span class="size-value">{{ exportFormatLabel }}<span v-if="exportQualityLabel" class="size-sub">{{ exportQualityLabel }}</span></span>
      </div>
      <div v-if="exportScaleHint" class="size-note">
        {{ exportScaleHint }}
      </div>
      <div v-if="selectedBatchCount > 0" class="size-note size-note--accent">
        已选择 {{ selectedBatchCount }} 个批量导出版本
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  &--info {
    padding: 12px 16px;
    border-bottom: none;
    flex: 1;
  }
}

.size-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.size-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.size-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.size-value {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'SF Mono', Monaco, monospace;

  &.highlight {
    color: var(--color-accent);
  }
}

.size-sub {
  margin-left: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-family: inherit;
}

.size-note {
  padding: 9px 10px;
  font-size: 10px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.44);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  &--accent {
    color: var(--accent-contrast-soft);
    border-color: var(--accent-border);
    background: var(--accent-surface);
  }
}
</style>
