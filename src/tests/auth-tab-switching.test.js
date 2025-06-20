import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuth, __resetAuthState } from '../composables/useAuth'

export function __resetAuthState() {
  // your reset logic here
}

describe('Auth Tab Switching', () => {
  let mockSupabase

  beforeEach(() => {
    __resetAuthState() // <-- Reset state before each test

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } }
        })),
        signOut: vi.fn(),
        signInWithPassword: vi.fn()
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should handle session expiry gracefully', async () => {
    const { refreshAuth } = useAuth(mockSupabase)

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })

    const result = await refreshAuth()
    expect(result).toBeNull()
    expect(mockSupabase.auth.getSession).toHaveBeenCalled()
  })
})