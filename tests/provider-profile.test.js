import { describe, expect, it } from 'vitest'
import {
  buildProfileSyncPatch,
  formatAccountHandle,
  getIdentityAccountHandle,
  getIdentityAvatarUrl,
  getPreferredIdentityAvatarUrl,
  getUserAccountHandle,
  sanitizePublicAvatarUrl,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserPrimaryEmail,
  normalizeLinuxDoAvatarUrl,
} from '../src/utils/auth/providerProfile.js'

describe('normalizeLinuxDoAvatarUrl', () => {
  it('replaces avatar template size and resolves relative Linux.do avatars', () => {
    expect(normalizeLinuxDoAvatarUrl('/user_avatar/linux.do/demo/{size}/1_2.png'))
      .toBe('https://linux.do/user_avatar/linux.do/demo/240/1_2.png')
  })

  it('preserves fully-qualified avatar URLs', () => {
    expect(normalizeLinuxDoAvatarUrl('https://cdn.example.com/avatar/{size}.png'))
      .toBe('https://cdn.example.com/avatar/240.png')
  })
})

describe('buildProfileSyncPatch', () => {
  it('fills Linux.do profile gaps from provider metadata', () => {
    const patch = buildProfileSyncPatch({
      app_metadata: {
        provider: 'custom:linuxdo',
      },
      email: '',
      user_metadata: {
        avatar_template: '/user_avatar/linux.do/demo/{size}/1_2.png',
        id: 9527,
        name: 'Linux.do 用户',
        trust_level: 3,
        username: 'Demo_User',
      },
    }, {
      avatar_url: null,
      display_name: null,
      extra: {},
      primary_email: null,
      primary_provider: null,
      username: null,
    })

    expect(patch.username).toBe('demo_user')
    expect(patch.display_name).toBe('Linux.do 用户')
    expect(patch.avatar_url).toBe('https://linux.do/user_avatar/linux.do/demo/240/1_2.png')
    expect(patch.primary_provider).toBe('custom:linuxdo')
    expect(patch.extra).toMatchObject({
      avatar_template: '/user_avatar/linux.do/demo/{size}/1_2.png',
      provider_user_id: '9527',
      provider_username: 'Demo_User',
      trust_level: 3,
    })
  })

  it('prefers direct avatar metadata when available', () => {
    const avatarUrl = getUserAvatarUrl({
      user_metadata: {
        avatar_template: '/user_avatar/linux.do/demo/{size}/1_2.png',
        picture: 'https://cdn.example.com/direct-avatar.png',
      },
    })

    expect(avatarUrl).toBe('https://cdn.example.com/direct-avatar.png')
  })

  it('falls back to metadata email when top-level email is absent', () => {
    const patch = buildProfileSyncPatch({
      app_metadata: {
        provider: 'google',
      },
      email: '',
      user_metadata: {
        email: 'oauth@example.com',
        preferred_username: 'demo_user',
      },
    }, {
      avatar_url: null,
      display_name: null,
      extra: {},
      primary_email: null,
      primary_provider: null,
      username: null,
    })

    expect(patch.primary_email).toBe('oauth@example.com')
    expect(patch.username).toBe('demo_user')
  })
})

describe('account identity helpers', () => {
  it('prefers provider handle for account display', () => {
    expect(getUserAccountHandle({
      user_metadata: {
        preferred_username: 'IT-NuanxinPro',
        user_name: 'fallback-user',
      },
    })).toBe('IT-NuanxinPro')
  })

  it('falls back to email local part when handle metadata is missing', () => {
    expect(getUserAccountHandle({
      email: 'demo@example.com',
    })).toBe('demo')
    expect(getIdentityAccountHandle({
      identity_data: {
        email: 'oauth@example.com',
      },
    })).toBe('oauth')
  })

  it('formats account handles with an at-sign', () => {
    expect(formatAccountHandle('IT-NuanxinPro')).toBe('@IT-NuanxinPro')
  })
})

describe('display name helpers', () => {
  it('prefers platform name before full_name', () => {
    expect(getUserDisplayName({
      user_metadata: {
        full_name: '雾島风起時',
        name: '暖心',
      },
    })).toBe('暖心')
  })

  it('falls back to metadata email when reading primary email', () => {
    expect(getUserPrimaryEmail({
      email: '',
      user_metadata: {
        email: 'meta@example.com',
      },
    })).toBe('meta@example.com')
  })
})

describe('getPreferredIdentityAvatarUrl', () => {
  it('skips Linux.do avatars and prefers embeddable providers', () => {
    const avatarUrl = getPreferredIdentityAvatarUrl([
      {
        provider: 'github',
        identity_data: {
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        },
      },
      {
        provider: 'custom:linuxdo',
        identity_data: {
          avatar_url: 'https://linux.do/user_avatar/linux.do/demo/240/1_2.png',
        },
      },
      {
        provider: 'google',
        identity_data: {
          picture: 'https://lh3.googleusercontent.com/demo=s96-c',
        },
      },
    ])

    expect(avatarUrl).toBe('https://lh3.googleusercontent.com/demo=s96-c')
  })

  it('uses avatar templates from identity data when needed', () => {
    const avatarUrl = getIdentityAvatarUrl({
      provider: 'custom:linuxdo',
      identity_data: {
        avatar_template: '/user_avatar/linux.do/demo/{size}/1_2.png',
      },
    })

    expect(avatarUrl).toBe('https://linux.do/user_avatar/linux.do/demo/240/1_2.png')
  })
})

describe('sanitizePublicAvatarUrl', () => {
  it('filters Linux.do avatar links for public embeds', () => {
    expect(sanitizePublicAvatarUrl('https://linux.do/user_avatar/linux.do/demo/240/1_2.png')).toBe('')
    expect(sanitizePublicAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4')).toBe('https://avatars.githubusercontent.com/u/1?v=4')
  })
})
