import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { reactive } from 'vue'
import AdminView from '../AdminView.vue'

const mockReplace = vi.fn()
const mockUserStore = reactive({ user: null })

vi.mock('@/stores/userStore', () => ({
  userStore: mockUserStore,
}))

function createMockRouter() {
  const r = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/admin', name: 'admin', component: AdminView },
      { path: '/home', name: 'home' },
    ],
  })
  r.replace = mockReplace
  return r
}

describe('AdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to home when user is not admin', async () => {
    mockUserStore.user = { userRole: 'user' }
    const router = createMockRouter()
    await router.push('/admin')

    mount(AdminView, {
      global: { plugins: [router] },
    })

    await new Promise((r) => setTimeout(r, 0))
    expect(mockReplace).toHaveBeenCalledWith({ name: 'home' })
  })

  it('shows Admin-Bereich when user is admin', async () => {
    mockUserStore.user = { userRole: 'admin' }
    const router = createMockRouter()
    await router.push('/admin')

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Admin-Bereich')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
