import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import VerifyEmailView from '../VerifyEmailView.vue'

vi.mock('@/api/client', () => ({
  getApiBase: () => 'http://api.test',
}))

describe('VerifyEmailView', () => {
  let router

  beforeEach(async () => {
    vi.clearAllMocks()
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
        { path: '/auth', name: 'auth' },
        { path: '/home', name: 'home' },
      ],
    })
    await router.push('/verify-email')
  })

  it('calls verify-email API and shows success when token is valid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Email verified successfully.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await router.push({ path: '/verify-email', query: { token: 'abc123' } })
    const wrapper = mount(VerifyEmailView, {
      global: {
        plugins: [router],
        stubs: { RouterLink: true },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 100))

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('verify-email'),
      expect.any(Object)
    )
    const text = wrapper.text()
    expect(text).toMatch(/bestätigt|Login|Startseite/i)
  })

  it('shows error when token is missing', async () => {
    await router.push({ path: '/verify-email', query: {} })
    const wrapper = mount(VerifyEmailView, {
      global: {
        plugins: [router],
        stubs: { RouterLink: true },
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.text()).toMatch(/ungültig|abgelaufen|fehlgeschlagen/i)
  })
})
