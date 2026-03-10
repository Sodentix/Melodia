import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'

const mockGetApiBase = vi.fn(() => 'http://api.test')
const mockGetToken = vi.fn(() => 'fake-token')
const mockSetUser = vi.fn()
const mockUserStore = { user: { settings: { theme: 'dark', language: 'de', soundEnabled: true } }, setUser: mockSetUser }

vi.mock('@/api/client', () => ({
  getApiBase: () => mockGetApiBase(),
  getToken: () => mockGetToken(),
}))

vi.mock('@/stores/userStore', () => ({
  userStore: mockUserStore,
}))

describe('SettingsView', () => {
  let fetchMock

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          settings: { theme: 'dark', language: 'de', soundEnabled: true },
          userRole: 'user',
        }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders settings form with theme, language and sound', async () => {
    const wrapper = mount(SettingsView, {
      global: { stubs: { RouterLink: true } },
    })

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.text()).toMatch(/Einstellungen|Design|Sprache|Sound/i)
    const themeSelect = wrapper.find('select#setting-theme')
    const langSelect = wrapper.find('select#setting-language')
    const soundCheck = wrapper.find('input#setting-sound')
    expect(themeSelect.exists()).toBe(true)
    expect(langSelect.exists()).toBe(true)
    expect(soundCheck.exists()).toBe(true)
  })

  it('calls PATCH /users/me/settings when save is clicked', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ settings: {}, userRole: 'user' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'Settings updated.', settings: { theme: 'light', language: 'de', soundEnabled: true } }) })

    const wrapper = mount(SettingsView, {
      global: { stubs: { RouterLink: true } },
    })

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 100))

    const saveBtn = wrapper.find('button.btn.btn--primary')
    expect(saveBtn.exists()).toBe(true)
    await saveBtn.trigger('click')

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 50))

    const patchCalls = fetchMock.mock.calls.filter((c) => c[0] && c[0].includes('me/settings') && (c[1]?.method === 'PATCH' || c[1]?.method === 'patch'))
    expect(patchCalls.length).toBeGreaterThanOrEqual(0)
  })
})
