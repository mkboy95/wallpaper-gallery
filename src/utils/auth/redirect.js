const DEFAULT_AUTH_REDIRECT = '/desktop'

export function normalizeRedirectTarget(target, fallback = DEFAULT_AUTH_REDIRECT) {
  if (typeof target !== 'string') {
    return fallback
  }

  const trimmed = target.trim()
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback
  }

  return trimmed
}

export function getAuthRedirectTargetFromRoute(route, fallback = DEFAULT_AUTH_REDIRECT) {
  return normalizeRedirectTarget(route?.query?.redirect || route?.query?.next, fallback)
}

export function buildAuthCallbackUrl(nextTarget = DEFAULT_AUTH_REDIRECT, context = {}) {
  const url = new URL('/auth/callback', window.location.origin)
  url.searchParams.set('next', normalizeRedirectTarget(nextTarget))

  const flow = typeof context.flow === 'string' ? context.flow.trim() : ''
  const provider = typeof context.provider === 'string' ? context.provider.trim() : ''

  if (flow) {
    url.searchParams.set('flow', flow)
  }

  if (provider) {
    url.searchParams.set('provider', provider)
  }

  return url.toString()
}
