export const AUTH_PROVIDER_DEFINITIONS = Object.freeze([
  {
    aliases: ['github'],
    description: '适合开发者账号快速登录，也方便后续公开收藏页接入 GitHub 身份。',
    key: 'github',
    kind: 'oauth',
    label: 'GitHub',
    oauthProvider: 'github',
  },
  {
    aliases: ['google'],
    description: '适合日常邮箱体系，移动端和多设备切换体验更顺手。',
    key: 'google',
    kind: 'oauth',
    label: 'Google',
    oauthProvider: 'google',
  },
  {
    aliases: ['custom:linuxdo', 'linuxdo'],
    description: '社区身份会跟随同一个用户资料，后续可扩展勋章、等级和公开主页。',
    key: 'linuxdo',
    kind: 'oauth',
    label: 'Linux.do',
    oauthProvider: 'custom:linuxdo',
  },
  {
    aliases: ['email'],
    description: '启用后可以直接使用邮箱和密码登录，不需要重新注册新账号。',
    key: 'email',
    kind: 'credentials',
    label: '邮箱密码',
  },
])

export const LINKABLE_OAUTH_PROVIDERS = Object.freeze(
  AUTH_PROVIDER_DEFINITIONS.filter(provider => provider.kind === 'oauth'),
)

function resolveLinuxDoProvider(provider, identityData) {
  if (provider.includes('linuxdo')) {
    return 'linuxdo'
  }

  const issuer = String(identityData?.iss || identityData?.issuer || '')
  if (/linux\.do/i.test(issuer)) {
    return 'linuxdo'
  }

  return provider
}

export function getAuthProviderKeyFromIdentity(identity) {
  const provider = String(identity?.provider || '').trim().toLowerCase()
  if (!provider) {
    return ''
  }

  if (provider === 'email' || provider === 'github' || provider === 'google') {
    return provider
  }

  return resolveLinuxDoProvider(provider, identity?.identity_data)
}

export function normalizeAuthProviderKey(value) {
  if (value && typeof value === 'object') {
    return getAuthProviderKeyFromIdentity(value)
  }

  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  return resolveLinuxDoProvider(normalized, null)
}

export function getAuthProviderDefinition(value) {
  const key = normalizeAuthProviderKey(value)
  if (!key) {
    return null
  }

  return AUTH_PROVIDER_DEFINITIONS.find(provider =>
    provider.key === key || provider.aliases.includes(key),
  ) || null
}

export function getLinkedIdentityByProvider(identities, providerKey) {
  const normalized = normalizeAuthProviderKey(providerKey)
  return (identities || []).find(identity => getAuthProviderKeyFromIdentity(identity) === normalized) || null
}

export function isAuthProviderLinked(identities, providerKey) {
  return Boolean(getLinkedIdentityByProvider(identities, providerKey))
}
