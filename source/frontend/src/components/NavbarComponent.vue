<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ProfilePicture from '@/components/ProfilePicture.vue'
import { userStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { clearSession } from '@/api/client'

const router = useRouter()
const canvasRef = ref(null)
const isMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)

const isAuthenticated = computed(() => !!userStore.user)
const currentUser = computed(() => userStore.user)

function logout() {
  clearSession()
  userStore.clearUser()
  closePopover()
  router.push({ name: 'auth' })
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

function toggleProfileMenu() {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

function closePopover() {
  isProfileMenuOpen.value = false
}

function handleClickOutside(event) {
  if (!event.target.closest('.profile-dropdown-wrapper')) {
    isProfileMenuOpen.value = false
  }
}

let animationId
let resizeObserver
let canvas
let ctx
let pixelRatio = 1

function resizeCanvas() {
  if (!canvas || !ctx) return
  pixelRatio = window.devicePixelRatio || 1
  const parent = canvas.parentElement
  const targetWidth = parent?.offsetWidth || window.innerWidth || 800
  const targetHeight = parent?.offsetHeight || 160
  canvas.width = targetWidth * pixelRatio
  canvas.height = targetHeight * pixelRatio
  canvas.style.width = `${targetWidth}px`
  canvas.style.height = `${targetHeight}px`
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(pixelRatio, pixelRatio)
}

function cleanupCanvasListeners() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('resize', resizeCanvas)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)

  canvas = canvasRef.value
  if (!canvas) return

  ctx = canvas.getContext('2d')
  if (ctx) {
    resizeCanvas()
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resizeCanvas)
      resizeObserver.observe(canvas.parentElement || canvas)
    } else {
      window.addEventListener('resize', resizeCanvas)
    }
  }

  const colors = [
    'rgba(255, 79, 219, 0.5)',
    'rgba(5, 217, 255, 0.45)',
    'rgba(61, 255, 140, 0.4)',
    'rgba(255, 255, 255, 0.3)'
  ]
  const lineWidths = [3.1, 2.8, 2.5, 2.3]
  let time = 0

  function mapWave(value, min, max) {
    return min + ((value + 1) / 2) * (max - min)
  }

  function draw() {
    if (!canvas || !ctx) return
    time += 0.018
    const width = canvas.width / pixelRatio
    const height = canvas.height / pixelRatio
    ctx.clearRect(0, 0, width, height)

    const topLimit = 20
    const bottomLimit = height - 20

    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath()
      for (let x = 0; x <= width; x += 6) {
        const primary = Math.sin((x * 0.018) + time * (1 + i * 0.6))
        const secondary = Math.sin(time * (0.6 + i * 0.18))
        const combined = primary * secondary * (1.1 - i * 0.12)
        const y = mapWave(combined, topLimit, bottomLimit)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = colors[i]
      ctx.lineWidth = lineWidths[i]
      ctx.stroke()
    }
    animationId = requestAnimationFrame(draw)
  }
  animationId = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  cleanupCanvasListeners()
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<template>
  <div id="navbar">
    <div class="wave-layer">
      <canvas ref="canvasRef" />
    </div>
    <div class="nav-inner">
      <div id="logo">{{ $t('nav.logo') }}</div>
      
      <button
        type="button"
        class="menu-toggle"
        :aria-expanded="isMenuOpen"
        aria-controls="primary-nav"
        @click="toggleMenu"
        :aria-label="$t('nav.navToggle')"
      >
        <span /><span /><span />
      </button>

      <nav id="primary-nav" :class="{ 'is-open': isMenuOpen }">
        <ul class="nav-list">
          <li>
            <router-link class="nav-link" :to="{ name: 'home' }" @click="closeMenu">
              {{ $t('nav.home') }}
            </router-link>
          </li>
          <li>
            <router-link
              class="nav-link"
              :to="{ path: '/home', hash: '#howtoplay' }"
              @click="closeMenu"
            >
              {{ $t('nav.howToPlay') }}
            </router-link>
          </li>
        </ul>

        <div class="nav-actions">
          <router-link
            class="btn btn--primary"
            v-if="!isAuthenticated"
            :to="{ name: 'auth' }"
            @click="closeMenu"
          >
            {{ $t('nav.signUp') }}
          </router-link>

          <div v-if="isAuthenticated" class="profile-dropdown-wrapper">
            <button class="profile-orb" id="profile-orb" @click="toggleProfileMenu" type="button">
              <ProfilePicture 
                  :can-toggle="false" 
                  :is-editable="false" 
                  :size="42" 
              />
            </button>

            <div v-show="isProfileMenuOpen" class="profile-popover" role="menu">
            <div class="popover-arrow"></div>
            <router-link :to="{ name: 'profile' }" class="dropdownOption" @click="closePopover()">{{ $t('nav.profile') }}</router-link>
            <router-link :to="{ name: 'settings' }" class="dropdownOption" @click="closePopover()">{{ $t('nav.settings') }}</router-link>
            <router-link v-if="currentUser?.userRole === 'admin'" :to="{ name: 'admin' }" class="dropdownOption" @click="closePopover()">{{ $t('nav.admin') }}</router-link>
            <p class="dropdownOption dropdownOption--danger" @click="logout">{{ $t('nav.logout') }}</p>
            </div>
          </div>
        </div>
      </nav>
    </div>
  </div>
</template>

<style scoped>
/* Allgemeine Navbar-Eigenschaften */
#navbar {
    display: flex;
    position: relative;
    background: rgba(10, 12, 28, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 1px 0 0 rgba(255, 79, 219, 0.04);
    min-height: 5rem;
    z-index: 999;
    padding: 0 1.5rem;
    width: 100%;
}

.nav-inner {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 1.5rem;
}

#primary-nav {
    display: flex;
    flex-direction: row;
    margin-left: auto;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    gap: 2rem;
}

#logo {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    font-family: Orbitron, sans-serif;
    font-size: clamp(20px, 2vw, 26px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ff4fdb, #05d9ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}


/* Navbar-Items */
.nav-list {
    display: flex;
    gap: 2rem;
    list-style: none;
}

.nav-link {
    position: relative;
    text-decoration: none;
    color: var(--text);
    font-weight: 600;
    letter-spacing: 0.04em;
    transition: color 0.22s ease;
    font-size: 1.1rem;
}

.nav-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    position: relative;
}

.profile-dropdown-wrapper {
    position: relative;
    display: inline-flex;
}

:deep(.router-link-exact-active[href="/home"])::after {
    transform: scaleX(1);
}

.nav-link::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -10px;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(135deg, #ff4fdb, #05d9ff);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s ease;
}

.nav-link:hover::after {
    transform: scaleX(1);
}

.nav-link:hover {
    color: #ffffff;
}


.menu-toggle {
    display: none;
    background: transparent;
    border: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
    padding: 0.5rem;
    margin-left: auto;
}

.menu-toggle span {
    width: 26px;
    height: 3px;
    background: linear-gradient(135deg, #ff4fdb, #05d9ff);
    display: block;
}

/* Wave animation */
.wave-layer {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

canvas {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  opacity: 0.5;
  filter: blur(0.2px) brightness(1.2);
}

/* Allgemeine Styles */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid var(--stroke);
    background: rgba(255,255,255,0.02);
    color: #ffffff;
    padding: 10px 22px;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.24s ease;
    text-decoration: none;
}
.btn.ghost:hover {
    border-color: rgba(255,255,255,0.24);
    background: rgba(255,255,255,0.08);
}


/* Account - aligned with auth gradient */
.profile-orb {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(255, 79, 219, 0.4), rgba(5, 217, 255, 0.35));
    box-shadow: 0 4px 16px rgba(5, 217, 255, 0.25);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: transform 0.22s ease, box-shadow 0.24s ease;
}

.profile-orb:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(5, 217, 255, 0.35);
}

/* Popover - glass card style */
.profile-popover {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(10, 12, 28, 0.95);
    backdrop-filter: blur(20px);
    color: var(--text);
    padding: 0.5rem 0.4rem;
    min-width: 9.5rem;
    z-index: 1000;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 79, 219, 0.06);
}

.popover-arrow {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 22px;
    height: 10px;
    background: rgba(10, 12, 28, 0.95);
    clip-path: polygon(0% 100%, 50% 0%, 100% 100%);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 10;
}

.dropdownOption {
    display: block;
    padding: 0.35rem 0.9rem;
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    border-radius: 8px;
    font-size: 0.95rem;
    white-space: nowrap;
}

.dropdownOption:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
}

.dropdownOption--danger {
    color: #ff4f83;
    font-weight: 600;
}

.dropdownOption--danger:hover {
    color: #ff6b8a;
    background: rgba(255, 79, 131, 0.2);
}

/* Iconify-Icon */
.profile-orb :deep(.userIcon) {
    font-size: 22px;
    color: white;
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7));
}

@media (max-width: 900px) {
    #navbar {
        padding: 0 1rem;
    }

    .menu-toggle {
        display: flex;
        z-index: 1001; /* Ensure it's above the overlay */
    }

    /* Hamburger Animation */
    .menu-toggle span {
        transition: all 0.3s ease-in-out;
        transform-origin: center;
    }

    .menu-toggle[aria-expanded="true"] span:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
    }

    .menu-toggle[aria-expanded="true"] span:nth-child(2) {
        opacity: 0;
        transform: translateX(-10px);
    }

    .menu-toggle[aria-expanded="true"] span:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
    }

    /* Full Screen Overlay - glass design */
    #primary-nav {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 12, 28, 0.92);
        backdrop-filter: blur(20px);
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-left: 0;
        gap: 2.5rem;
        z-index: 1000;

        /* Transition states */
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        transform: scale(0.95);
    }

    #primary-nav.is-open {
        opacity: 1;
        visibility: visible;
        pointer-events: all;
        transform: scale(1);
        max-height: 100vh; /* Override previous max-height */
    }

    .nav-inner {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }
    .nav-list {
        flex-direction: column;
        width: auto;
        gap: 2rem;
        align-items: center;
    }

    .nav-link {
        font-size: 2rem; /* Larger font for mobile */
        font-weight: 700;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.4s ease, transform 0.4s ease;
    }

    #primary-nav.is-open .nav-link {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0.1s;
    }

    #primary-nav.is-open .nav-list li:nth-child(1) .nav-link { transition-delay: 0.1s; }
    #primary-nav.is-open .nav-list li:nth-child(2) .nav-link { transition-delay: 0.2s; }

    .nav-actions {
        width: auto;
        justify-content: center;
        flex-direction: column;
        gap: 1.5rem;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.4s ease, transform 0.4s ease;
        position: relative;
    }

    #primary-nav.is-open .nav-actions {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0.3s;
    }
}
</style>
