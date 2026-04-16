<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthFlowPanel from '@/components/login/AuthFlowPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { formatSupabaseAuthError } from '@/utils/auth/errors'
import { getAuthProviderDefinition } from '@/utils/auth/providers'
import { getAuthRedirectTargetFromRoute } from '@/utils/auth/redirect'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const state = ref('loading')
const message = ref('正在完成登录并恢复账号信息...')
const callbackFlow = computed(() => String(route.query.flow || 'signin'))
const callbackProvider = computed(() => getAuthProviderDefinition(route.query.provider)?.label || '该登录方式')
const isLinkFlow = computed(() => callbackFlow.value === 'link')
const panelState = computed(() => {
  if (state.value === 'error') {
    return 'error'
  }
  if (state.value === 'success') {
    return 'success'
  }
  return 'loading'
})
const eyebrow = computed(() => (isLinkFlow.value ? '账号关联中' : '授权登录中'))
const title = computed(() => {
  if (state.value === 'error') {
    return isLinkFlow.value ? '账号关联未完成' : '登录未完成'
  }

  return isLinkFlow.value ? '关联账号中' : '账号同步中'
})

const callbackRawError = computed(() =>
  route.query.error_code || route.query.error_description || route.query.error || authStore.lastError,
)
const callbackError = computed(() => formatSupabaseAuthError({
  code: route.query.error_code,
  error: route.query.error,
  error_description: route.query.error_description,
  message: route.query.error_description || route.query.error || authStore.lastError,
}, '登录未完成，请稍后再试。'))

async function finishAuthCallback() {
  message.value = isLinkFlow.value
    ? `正在完成 ${callbackProvider.value} 绑定并恢复账号信息...`
    : '正在完成登录并恢复账号信息...'

  if (!authStore.isConfigured) {
    state.value = 'error'
    message.value = '当前环境没有配置 Supabase Auth。'
    return
  }

  if (callbackRawError.value) {
    state.value = 'error'
    message.value = callbackError.value
    return
  }

  // 初始化 auth store
  await authStore.initialize()

  // 等待 Supabase 处理 URL 中的认证参数
  let retryCount = 0
  const maxRetries = 5
  const retryDelay = 1000

  while (!authStore.isAuthenticated && retryCount < maxRetries) {
    retryCount++
    message.value = `正在处理认证信息... (${retryCount}/${maxRetries})`
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    await authStore.refreshSession()
  }

  if (!authStore.isAuthenticated) {
    state.value = 'error'
    message.value = authStore.lastError || '登录会话未建立，请重新尝试。'
    return
  }

  if (!isLinkFlow.value) {
    authStore.finalizeCurrentAuthProvider(route.query.provider)
  }

  state.value = 'success'
  message.value = isLinkFlow.value
    ? `${callbackProvider.value} 已绑定到当前账号，正在返回账号中心...`
    : `欢迎回来，${authStore.displayName}。正在跳转...`

  const target = getAuthRedirectTargetFromRoute(route, isLinkFlow.value ? '/account' : undefined)
  window.setTimeout(() => {
    router.replace(target)
  }, 320)
}

onMounted(() => {
  finishAuthCallback()
})
</script>

<template>
  <div class="auth-callback-page">
    <div class="auth-callback-shell">
      <AuthFlowPanel
        :badge="callbackProvider"
        :eyebrow="eyebrow"
        :state="panelState"
        :text="message"
        :title="title"
      >
        <template v-if="state === 'error'" #actions>
          <RouterLink class="auth-callback-action auth-callback-action--primary" :to="isLinkFlow ? '/account' : '/login'">
            {{ isLinkFlow ? '返回账号中心' : '返回登录页' }}
          </RouterLink>
        </template>
      </AuthFlowPanel>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auth-callback-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 14% 18%, rgba(96, 165, 250, 0.2), transparent 24%),
    radial-gradient(circle at 82% 14%, rgba(56, 189, 248, 0.16), transparent 26%),
    radial-gradient(circle at 78% 82%, rgba(37, 99, 235, 0.12), transparent 28%), var(--page-gradient);
}

.auth-callback-page::before {
  content: '';
  position: absolute;
  inset: 26px;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.12),
    transparent 32%,
    rgba(255, 255, 255, 0.04) 72%,
    transparent 100%
  );
  pointer-events: none;
  opacity: 0.7;

  [data-theme='dark'] & {
    border-color: rgba(148, 163, 184, 0.12);
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.06),
      transparent 32%,
      rgba(255, 255, 255, 0.02) 72%,
      transparent 100%
    );
  }
}

.auth-callback-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 540px);
}

.auth-callback-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  font-weight: 700;
  transition:
    transform 180ms ease,
    opacity 180ms ease,
    box-shadow 180ms ease;
}

.auth-callback-action--primary {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.24);
}

.auth-callback-action:hover {
  transform: translateY(-1px);
  opacity: 0.96;
}
</style>
