<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const quickNotes = [
  '回到首页后可以直接从热门分类和热门关键词继续找图。',
  'Bing、头像、手机和电脑壁纸都还在，只是这页走丢了。',
]

const previewCards = [
  {
    badge: 'DESKTOP',
    title: '电脑壁纸',
    text: '宽屏大图、清晰预览、按分辨率快速筛选。',
    meta: '4K / 5K / 8K',
    tone: 'violet',
  },
  {
    badge: 'BING',
    title: '每日 Bing',
    text: '按年份归档，适合回看和精确定位某一天的图。',
    meta: '2019 - Now',
    tone: 'cyan',
  },
  {
    badge: 'AVATAR',
    title: '头像与制作',
    text: '浏览素材之外，还能直接裁剪和导出成品。',
    meta: 'DIY Ready',
    tone: 'sunset',
  },
]

function goHome() {
  router.push('/')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push('/')
}
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-page__glow not-found-page__glow--violet" />
    <div class="not-found-page__glow not-found-page__glow--cyan" />

    <div class="container not-found-page__shell">
      <section class="not-found-panel">
        <div class="not-found-copy">
          <p class="not-found-copy__eyebrow">
            Wallpaper Gallery / Lost In Gallery
          </p>

          <div class="not-found-copy__status">
            <span class="not-found-copy__code">404</span>
            <span class="not-found-copy__status-divider" />
            <span class="not-found-copy__label">页面未找到</span>
          </div>

          <h1 class="not-found-copy__title">
            这页迷失在画廊深处
          </h1>

          <p class="not-found-copy__summary">
            你访问的链接可能已经失效、被移动，或者只是暂时躲起来了。先回到首页继续挑图，热门分类和热门关键词会更快把你带回内容里。
          </p>

          <div class="not-found-actions">
            <button class="not-found-button not-found-button--primary" @click="goHome">
              返回首页
            </button>
            <button class="not-found-button not-found-button--ghost" @click="goBack">
              返回上一页
            </button>
          </div>

          <ul class="not-found-notes">
            <li v-for="note in quickNotes" :key="note">
              {{ note }}
            </li>
          </ul>
        </div>

        <div class="not-found-visual" aria-hidden="true">
          <div class="not-found-visual__ring not-found-visual__ring--outer" />
          <div class="not-found-visual__ring not-found-visual__ring--inner" />
          <div class="not-found-visual__beam" />

          <div class="preview-stack">
            <article
              v-for="card in previewCards"
              :key="card.badge"
              class="preview-card"
              :class="`preview-card--${card.tone}`"
            >
              <span class="preview-card__badge">{{ card.badge }}</span>
              <strong>{{ card.title }}</strong>
              <p>{{ card.text }}</p>
              <span class="preview-card__meta">{{ card.meta }}</span>
            </article>
          </div>

          <div class="signal-chip">
            Lost frame · recover route
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found-page {
  position: relative;
  min-height: calc(100vh - var(--header-height));
  min-height: calc(100dvh - var(--header-height));
  padding: clamp(28px, 5vw, 72px) 0;
  overflow: hidden;
  background: var(--page-gradient);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    -webkit-mask-image: radial-gradient(circle at center, black 42%, transparent 100%);
    mask-image: radial-gradient(circle at center, black 42%, transparent 100%);
    pointer-events: none;
    opacity: 0.6;
  }
}

.not-found-page__glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(50px);
  opacity: 0.5;
  pointer-events: none;

  &--violet {
    top: 10%;
    left: -70px;
    width: 220px;
    height: 220px;
    background: rgba(var(--color-accent-rgb), 0.28);
  }

  &--cyan {
    right: -80px;
    bottom: 10%;
    width: 260px;
    height: 260px;
    background: rgba(34, 211, 238, 0.18);
  }
}

.not-found-page__shell {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  min-height: calc(100vh - var(--header-height) - 96px);
  min-height: calc(100dvh - var(--header-height) - 96px);
}

.not-found-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: clamp(28px, 4vw, 56px);
  width: 100%;
  padding: clamp(24px, 4vw, 48px);
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 32px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.5));
  box-shadow: 0 24px 80px rgba(16, 24, 40, 0.14);
  backdrop-filter: blur(24px);
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(120deg, rgba(255, 255, 255, 0.18), transparent 26%),
      linear-gradient(310deg, rgba(var(--color-accent-rgb), 0.08), transparent 36%);
    pointer-events: none;
  }
}

.not-found-copy,
.not-found-visual {
  position: relative;
  z-index: 1;
}

.not-found-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.not-found-copy__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-accent);
  background: var(--accent-surface);
  box-shadow: inset 0 0 0 1px var(--accent-border);
}

.not-found-copy__status {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
  padding: 10px 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.not-found-copy__code {
  font-size: clamp(18px, 2.4vw, 24px);
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: 0.08em;
}

.not-found-copy__status-divider {
  width: 1px;
  height: 18px;
  background: rgba(15, 23, 42, 0.12);
}

.not-found-copy__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.not-found-copy__title {
  max-width: 620px;
  margin-top: 20px;
  font-size: clamp(27px, 5vw, 55px);
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--color-text-primary);
}

.not-found-copy__summary {
  max-width: 620px;
  margin-top: 18px;
  font-size: clamp(16px, 1.8vw, 19px);
  line-height: 1.8;
  color: var(--color-text-secondary);
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 32px;
}

.not-found-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 148px;
  min-height: 52px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal),
    background-color var(--transition-normal),
    color var(--transition-normal);

  &:hover {
    transform: translateY(-2px);
  }

  &--primary {
    color: #fff;
    background: var(--accent-gradient);
    box-shadow: 0 18px 34px var(--accent-shadow);

    &:hover {
      box-shadow: 0 22px 40px var(--accent-shadow-strong);
    }
  }

  &--ghost {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.5);
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);

    &:hover {
      background: rgba(255, 255, 255, 0.76);
      box-shadow: inset 0 0 0 1px var(--accent-border);
    }
  }
}

.not-found-notes {
  display: grid;
  gap: 12px;
  margin-top: 30px;
}

.not-found-notes li {
  position: relative;
  padding-left: 18px;
  font-size: 14px;
  color: var(--color-text-secondary);

  &::before {
    content: '';
    position: absolute;
    top: 9px;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-gradient);
    box-shadow: 0 0 0 4px var(--accent-ring);
  }
}

.not-found-visual {
  position: relative;
  min-height: 460px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.not-found-visual__ring,
.not-found-visual__beam {
  position: absolute;
  pointer-events: none;
}

.not-found-visual__ring {
  border-radius: 50%;
  border: 1px solid var(--accent-border);

  &--outer {
    width: 420px;
    height: 420px;
    border-style: solid;
    animation: ringRotate 18s linear infinite;
  }

  &--inner {
    width: 290px;
    height: 290px;
    border-style: dashed;
    animation: ringRotateReverse 14s linear infinite;
  }
}

.not-found-visual__beam {
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.7) 0%,
    rgba(var(--color-accent-rgb), 0.16) 44%,
    transparent 74%
  );
  filter: blur(6px);
  z-index: 0;
}

.preview-stack {
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
  height: 420px;
}

.preview-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 220px;
  padding: 20px;
  border-radius: 26px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 24px 44px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
  color: var(--color-text-primary);
  animation: floatCard 7s ease-in-out infinite;

  strong {
    font-size: 22px;
    line-height: 1.15;
  }

  p {
    min-height: 72px;
    font-size: 13px;
    line-height: 1.75;
    color: var(--color-text-secondary);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.04)),
      linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 70%);
    opacity: 0.55;
    pointer-events: none;
  }

  > * {
    position: relative;
    z-index: 1;
  }

  &:nth-child(1) {
    top: 20px;
    left: 4px;
    transform: rotate(-9deg);
  }

  &:nth-child(2) {
    top: 92px;
    right: 2px;
    transform: rotate(9deg);
    animation-delay: -2.2s;
  }

  &:nth-child(3) {
    bottom: 6px;
    left: 48px;
    transform: rotate(-4deg);
    animation-delay: -4.1s;
  }
}

.preview-card__badge,
.preview-card__meta {
  display: inline-flex;
  width: fit-content;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.preview-card__badge {
  color: rgba(15, 23, 42, 0.72);
  background: rgba(255, 255, 255, 0.58);
}

.preview-card__meta {
  margin-top: auto;
  color: var(--color-text-primary);
  background: rgba(15, 23, 42, 0.06);
}

.preview-card--violet {
  background: linear-gradient(155deg, rgba(var(--color-accent-rgb), 0.3), rgba(255, 255, 255, 0.76));
}

.preview-card--cyan {
  background: linear-gradient(155deg, rgba(34, 211, 238, 0.26), rgba(255, 255, 255, 0.78));
}

.preview-card--sunset {
  background: linear-gradient(155deg, rgba(251, 191, 36, 0.24), rgba(255, 255, 255, 0.8));
}

.signal-chip {
  position: absolute;
  right: 22px;
  bottom: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.56);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

@keyframes floatCard {
  0%,
  100% {
    transform: translateY(0) rotate(var(--card-rotate, 0deg));
  }
  50% {
    transform: translateY(-12px) rotate(var(--card-rotate, 0deg));
  }
}

@keyframes ringRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes ringRotateReverse {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

.preview-card:nth-child(1) {
  --card-rotate: -9deg;
}

.preview-card:nth-child(2) {
  --card-rotate: 9deg;
}

.preview-card:nth-child(3) {
  --card-rotate: -4deg;
}

:global([data-theme='dark']) .not-found-page::before {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
}

:global([data-theme='dark']) .not-found-panel {
  border-color: var(--accent-border);
  background: linear-gradient(145deg, rgba(26, 26, 46, 0.9), rgba(26, 26, 46, 0.74));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
}

:global([data-theme='dark']) .not-found-copy__status,
:global([data-theme='dark']) .not-found-button--ghost,
:global([data-theme='dark']) .signal-chip,
:global([data-theme='dark']) .preview-card__meta {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

:global([data-theme='dark']) .preview-card__badge {
  color: rgba(248, 250, 252, 0.82);
  background: rgba(15, 23, 42, 0.24);
}

:global([data-theme='dark']) .preview-card--violet {
  background: linear-gradient(155deg, rgba(var(--color-accent-rgb), 0.26), rgba(30, 30, 50, 0.88));
}

:global([data-theme='dark']) .preview-card--cyan {
  background: linear-gradient(155deg, rgba(34, 211, 238, 0.2), rgba(30, 30, 50, 0.88));
}

:global([data-theme='dark']) .preview-card--sunset {
  background: linear-gradient(155deg, rgba(251, 191, 36, 0.18), rgba(30, 30, 50, 0.88));
}

@include tablet-only {
  .not-found-panel {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .not-found-copy__title {
    max-width: 100%;
  }

  .not-found-visual {
    min-height: 360px;
  }
}

@include mobile-only {
  .not-found-page {
    padding: calc($spacing-lg + 52px) 0 $spacing-xl;
  }

  .not-found-page__shell {
    min-height: auto;
  }

  .not-found-panel {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 20px;
    border-radius: 24px;
  }

  .not-found-copy {
    align-items: stretch;
  }

  .not-found-copy__eyebrow {
    letter-spacing: 0.12em;
  }

  .not-found-copy__status {
    margin-top: 18px;
  }

  .not-found-copy__title {
    margin-top: 18px;
    font-size: clamp(34px, 11vw, 50px);
  }

  .not-found-copy__summary {
    font-size: 15px;
    line-height: 1.75;
    max-width: 100%;
  }

  .not-found-actions {
    width: 100%;
    flex-direction: column;
  }

  .not-found-button {
    width: 100%;
  }

  .not-found-visual {
    min-height: auto;
    padding-top: 4px;
  }

  .not-found-visual__ring,
  .not-found-visual__beam {
    display: none;
  }

  .preview-stack {
    display: grid;
    width: 100%;
    height: auto;
    gap: 14px;
  }

  .preview-card {
    position: relative;
    inset: auto;
    width: 100%;
    padding: 18px;
    border-radius: 22px;
    transform: none !important;
    animation-duration: 8s;

    p {
      min-height: 0;
    }
  }

  .signal-chip {
    position: static;
    display: flex;
    justify-content: center;
    width: 100%;
    margin-top: 14px;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found-visual__ring,
  .preview-card {
    animation: none !important;
  }

  .not-found-button {
    transition: none;
  }
}
</style>
