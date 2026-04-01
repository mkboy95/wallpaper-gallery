import { describe, expect, it } from 'vitest'
import {
  getAuthProviderDefinition,
  getAuthProviderKeyFromIdentity,
  getLinkedIdentityByProvider,
  isAuthProviderLinked,
  normalizeAuthProviderKey,
} from '../src/utils/auth/providers.js'

describe('auth provider helpers', () => {
  it('normalizes linuxdo aliases to a stable provider key', () => {
    expect(normalizeAuthProviderKey('custom:linuxdo')).toBe('linuxdo')
    expect(normalizeAuthProviderKey('linuxdo')).toBe('linuxdo')
  })

  it('recognizes Linux.do identities even when provider is custom with issuer metadata', () => {
    expect(getAuthProviderKeyFromIdentity({
      identity_data: {
        iss: 'https://connect.linux.do',
      },
      provider: 'custom',
    })).toBe('linuxdo')
  })

  it('finds linked identities by normalized provider key', () => {
    const identities = [
      {
        email: 'demo@example.com',
        provider: 'github',
      },
      {
        identity_data: {
          iss: 'https://connect.linux.do',
          preferred_username: 'demo_user',
        },
        provider: 'custom',
      },
    ]

    expect(isAuthProviderLinked(identities, 'github')).toBe(true)
    expect(isAuthProviderLinked(identities, 'custom:linuxdo')).toBe(true)
    expect(getLinkedIdentityByProvider(identities, 'linuxdo')?.identity_data?.preferred_username).toBe('demo_user')
    expect(getAuthProviderDefinition('custom:linuxdo')?.label).toBe('Linux.do')
  })
})
