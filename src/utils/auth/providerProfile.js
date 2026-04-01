const DEFAULT_LINUX_DO_ORIGIN = 'https://linux.do'
const DEFAULT_LINUX_DO_AVATAR_SIZE = '240'
const AVATAR_PROVIDER_PRIORITY = Object.freeze(['google', 'github', 'linuxdo'])

export function getUserMetadataValue(user, ...keys) {
  const metadata = user?.user_metadata || {}

  for (const key of keys) {
    if (typeof metadata[key] === 'string' && metadata[key].trim()) {
      return metadata[key].trim()
    }
  }

  return ''
}

function getEmailLocalPart(value) {
  const normalized = String(value || '').trim()
  if (!normalized.includes('@')) {
    return ''
  }

  return normalized.split('@')[0]?.trim() || ''
}

export function sanitizePublicAvatarUrl(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  if (/^https?:\/\/linux\.do\//i.test(normalized)) {
    return ''
  }

  return normalized
}

export function getIdentityMetadataValue(identity, ...keys) {
  const metadata = identity?.identity_data || {}

  for (const key of keys) {
    if (typeof metadata[key] === 'string' && metadata[key].trim()) {
      return metadata[key].trim()
    }
  }

  return ''
}

export function getUserPrimaryEmail(user) {
  return String(user?.email || '').trim() || getUserMetadataValue(user, 'email')
}

export function getIdentityPrimaryEmail(identity) {
  return String(identity?.email || '').trim() || getIdentityMetadataValue(identity, 'email')
}

export function getUserAccountHandle(user) {
  return getUserMetadataValue(user, 'preferred_username', 'user_name', 'username')
    || getEmailLocalPart(getUserPrimaryEmail(user))
    || ''
}

export function getIdentityAccountHandle(identity) {
  return getIdentityMetadataValue(identity, 'preferred_username', 'user_name', 'username')
    || getEmailLocalPart(getIdentityPrimaryEmail(identity))
    || ''
}

export function formatAccountHandle(value) {
  const normalized = String(value || '').trim()
  return normalized ? `@${normalized}` : ''
}

function normalizeProfileExtra(extra) {
  return extra && typeof extra === 'object' && !Array.isArray(extra) ? { ...extra } : {}
}

function replaceAvatarTemplateSize(value, size = DEFAULT_LINUX_DO_AVATAR_SIZE) {
  return String(value || '').replaceAll('{size}', size)
}

export function normalizeLinuxDoAvatarUrl(avatarTemplate, size = DEFAULT_LINUX_DO_AVATAR_SIZE) {
  const normalized = replaceAvatarTemplateSize(avatarTemplate, size).trim()
  if (!normalized) {
    return ''
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized
  }

  if (normalized.startsWith('//')) {
    return `https:${normalized}`
  }

  const normalizedPath = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `${DEFAULT_LINUX_DO_ORIGIN}${normalizedPath}`
}

export function getUserDisplayName(user) {
  return getUserMetadataValue(user, 'display_name', 'name', 'full_name', 'preferred_username', 'user_name', 'username')
    || getEmailLocalPart(getUserPrimaryEmail(user))
    || '用户'
}

export function getUserPrimaryProvider(user) {
  return user?.app_metadata?.provider || user?.user_metadata?.provider || 'email'
}

export function getUserAvatarUrl(user) {
  const directAvatar = getUserMetadataValue(user, 'avatar_url', 'picture')
  if (directAvatar) {
    return directAvatar
  }

  return normalizeLinuxDoAvatarUrl(getUserMetadataValue(user, 'avatar_template'))
}

function normalizeIdentityProvider(identity) {
  const provider = String(identity?.provider || '').trim().toLowerCase()
  if (!provider) {
    return ''
  }

  if (provider.includes('linuxdo')) {
    return 'linuxdo'
  }

  return provider
}

export function getIdentityAvatarUrl(identity) {
  const directAvatar = getIdentityMetadataValue(identity, 'avatar_url', 'picture')
  if (directAvatar) {
    return directAvatar
  }

  return normalizeLinuxDoAvatarUrl(getIdentityMetadataValue(identity, 'avatar_template'))
}

export function getPreferredIdentityAvatarUrl(identities) {
  return getPreferredIdentityAvatarUrls(identities)[0] || ''
}

export function getPreferredIdentityAvatarUrls(identities) {
  const normalizedIdentities = Array.isArray(identities)
    ? identities
        .map(identity => ({
          avatarUrl: sanitizePublicAvatarUrl(getIdentityAvatarUrl(identity)),
          provider: normalizeIdentityProvider(identity),
        }))
        .filter(item => item.avatarUrl)
    : []

  const orderedAvatarUrls = []

  for (const providerKey of AVATAR_PROVIDER_PRIORITY) {
    const matches = normalizedIdentities.filter(item => item.provider === providerKey)
    for (const match of matches) {
      if (!orderedAvatarUrls.includes(match.avatarUrl)) {
        orderedAvatarUrls.push(match.avatarUrl)
      }
    }
  }

  for (const item of normalizedIdentities) {
    if (!orderedAvatarUrls.includes(item.avatarUrl)) {
      orderedAvatarUrls.push(item.avatarUrl)
    }
  }

  return orderedAvatarUrls
}

function sanitizeUsername(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')

  return normalized || ''
}

function buildLinuxDoExtra(user, currentExtra) {
  const metadata = user?.user_metadata || {}
  const nextExtra = normalizeProfileExtra(currentExtra)
  let changed = false

  const avatarTemplate = getUserMetadataValue(user, 'avatar_template')
  if (avatarTemplate && nextExtra.avatar_template !== avatarTemplate) {
    nextExtra.avatar_template = avatarTemplate
    changed = true
  }

  const username = getUserMetadataValue(user, 'preferred_username', 'user_name', 'username')
  if (username && nextExtra.provider_username !== username) {
    nextExtra.provider_username = username
    changed = true
  }

  if (typeof metadata.id === 'number' || typeof metadata.id === 'string') {
    const providerUserId = String(metadata.id)
    if (nextExtra.provider_user_id !== providerUserId) {
      nextExtra.provider_user_id = providerUserId
      changed = true
    }
  }

  if (typeof metadata.trust_level === 'number' && nextExtra.trust_level !== metadata.trust_level) {
    nextExtra.trust_level = metadata.trust_level
    changed = true
  }

  return changed ? nextExtra : null
}

export function buildProfileSyncPatch(user, currentProfile) {
  if (!user || !currentProfile) {
    return {}
  }

  const patch = {}
  const username = sanitizeUsername(getUserMetadataValue(user, 'preferred_username', 'user_name', 'username'))
  const displayName = getUserDisplayName(user)
  const avatarUrl = getUserAvatarUrl(user)
  const primaryEmail = getUserPrimaryEmail(user) || null
  const primaryProvider = getUserPrimaryProvider(user)

  if (!currentProfile.username && username) {
    patch.username = username
  }

  if (!currentProfile.display_name && displayName) {
    patch.display_name = displayName
  }

  if (!currentProfile.avatar_url && avatarUrl) {
    patch.avatar_url = avatarUrl
  }

  if (!currentProfile.primary_email && primaryEmail) {
    patch.primary_email = primaryEmail
  }

  if (!currentProfile.primary_provider && primaryProvider) {
    patch.primary_provider = primaryProvider
  }

  if (primaryProvider === 'custom:linuxdo') {
    const extra = buildLinuxDoExtra(user, currentProfile.extra)
    if (extra) {
      patch.extra = extra
    }
  }

  return patch
}
