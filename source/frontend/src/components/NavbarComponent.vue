<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';

const canvasRef = ref(null);
const isAuthenticated = ref(false);
const isMenuOpen = ref(false);
let animationId;
let resizeObserver;
let canvas;
let ctx;
let pixelRatio = 1;

const apiRoot = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';
const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`;

async function validateSession() {
  const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');

  if (!token || !authBase) {
    isAuthenticated.value = false;
    return;
  }

  try {
    const { data } = await axios.get(`${authBase}/isAuthed`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    isAuthenticated.value = Boolean(data?.loggedIn);

    if (data?.loggedIn && data.user) {
      localStorage.setItem('melodia_user', JSON.stringify(data.user));
    }
  } catch (error) {
    console.warn('Navbar auth check failed:', error.response?.data || error.message);
    isAuthenticated.value = false;
    localStorage.removeItem('melodia_token');
    localStorage.removeItem('token');
    localStorage.removeItem('melodia_user');
  }
}

function handleAuthChange() {
  validateSession();
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

// Code für das Abmelden
function logout() {
  localStorage.removeItem("melodia_token");
  isAuthenticated.value = false;
}

// Code um das Popover zu schließen
function closePopover() {
  const popoverElement = document.getElementById("profileMenu");
  if (popoverElement?.hidePopover) popoverElement.hidePopover();
}


// Code für die Wellenanimation
function resizeCanvas() {
  if (!canvas || !ctx) {
    return;
  }

  pixelRatio = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const targetWidth = parent?.offsetWidth || window.innerWidth || 800;
  const targetHeight = parent?.offsetHeight || 160;

  canvas.width = targetWidth * pixelRatio;
  canvas.height = targetHeight * pixelRatio;
  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(pixelRatio, pixelRatio);
}

function cleanupCanvasListeners() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener('resize', resizeCanvas);
}

onMounted(() => {
  validateSession();
  window.addEventListener('melodia-auth-changed', handleAuthChange);

  canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  ctx = canvas.getContext('2d');

  if (canvas) {
    resizeCanvas();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas.parentElement || canvas);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }
  }

    const colors = [
    'rgba(255,0,200,0.6)',
    'rgba(0,236,255,0.5)',
    'rgba(61,255,140,0.45)',
    'rgba(255,255,255,0.35)'
    ];

  const lineWidths = [3.1, 2.8, 2.5, 2.3];
  let time = 0;

  function mapWave(value, min, max) {
    return min + ((value + 1) / 2) * (max - min);
  }

  function draw() {
    if (!canvas || !ctx) {
      return;
    }
    time += 0.018;
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;
    ctx.clearRect(0, 0, width, height);

    const topLimit = 20;
    const bottomLimit = height - 20;

    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const primary = Math.sin((x * 0.018) + time * (1 + i * 0.6));
        const secondary = Math.sin(time * (0.6 + i * 0.18));
        const combined = primary * secondary * (1.1 - i * 0.12);
        const y = mapWave(combined, topLimit, bottomLimit);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = lineWidths[i];
      ctx.stroke();
    }

    animationId = requestAnimationFrame(draw);
  }

  // Start Animation
  animationId = requestAnimationFrame(draw);

  // Cleanup bei Unmount
});

onBeforeUnmount(() => {
  window.removeEventListener('melodia-auth-changed', handleAuthChange);
  cleanupCanvasListeners();
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
</script>

<template>
  <div id="navbar">
    <div class="wave-layer">
      <canvas ref="canvasRef" />
    </div>
    <div class="nav-inner">
      <div id="logo">Melodia - Feel The Rythm.</div>
      <button
        type="button"
        class="menu-toggle"
        :aria-expanded="isMenuOpen"
        aria-controls="primary-nav"
        @click="toggleMenu"
        aria-label="Navigation öffnen oder schließen"
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="primary-nav" :class="{ 'is-open': isMenuOpen }">
        <ul class="nav-list">
          <li>
            <router-link class="nav-link" :to="{ name: 'home' }" @click="closeMenu">
              Home
            </router-link>
          </li>
          <li>
            <router-link
              class="nav-link"
              :to="{ path: '/home', hash: '#howtoplay' }"
              @click="closeMenu"
            >
              How to play
            </router-link>
          </li>
        </ul>
        <div class="nav-actions">
          <router-link
            class="btn primary"
            v-if="!isAuthenticated"
            :to="{ name: 'auth' }"
            @click="closeMenu"
          >
            Sign Up
          </router-link>
          <button v-if="isAuthenticated" popovertarget="profileMenu" class="profile-orb" id="profile-orb">
            <Icon icon="solar:user-bold-duotone" class="userIcon" />
          </button>

          <div id="profileMenu" popover class="profile-popover" anchor="profile-orb">
            <div class="popover-arrow"></div> 

            <router-link :to="{ name: 'profile' }" class="dropdownOption" @click="closePopover()">Profil</router-link>
            <p class="dropdownOption" @click="logout(), closePopover()">Abmelden</p>
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
    background-color: black;
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
    background: linear-gradient(120deg, var(--accent-pink), var(--accent-cyan), var(--accent-green));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 22px rgba(0, 236, 255, 0.2);
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
    background: var(--gradient-accent);
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
    background: linear-gradient(120deg, var(--accent-pink), var(--accent-cyan));
    display: block;
}


/* Wellenanimation / Canvas */
canvas {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  opacity: 0.5;
  filter: blur(0.2px) brightness(1.2);
}

.wave-layer {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
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
.btn.primary {
    border: none;
    background: var(--gradient-accent);
    box-shadow: 0 10px 32px rgba(255,0,200,0.18);
    color: #050505;
}
.btn.primary:hover { transform: translateY(-2px); }
.btn.ghost:hover {
    border-color: rgba(255,255,255,0.24);
    background: rgba(255,255,255,0.08);
}


/* Account */
.profile-orb {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    /* Neon-Gradient passend zu deinem Wave-Design */
    background: radial-gradient(
        circle at 30% 30%,
        rgba(255, 0, 200, 0.55),
        rgba(0, 236, 255, 0.50),
        rgba(61, 255, 140, 0.45)
    );

    /* Outer Glow */
    box-shadow:
        0 0 14px rgba(255, 0, 200, 0.55),
        0 0 28px rgba(0, 236, 255, 0.45),
        0 0 42px rgba(61, 255, 140, 0.35);

    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.12);

    transition:
        transform 0.22s ease,
        box-shadow 0.24s ease;
}

.profile-orb:hover {
    transform: translateY(-2px);
    box-shadow:
        0 0 20px rgba(255, 0, 200, 0.75),
        0 0 32px rgba(0, 236, 255, 0.60),
        0 0 50px rgba(61, 255, 140, 0.50);
}

/* Popover */
.profile-popover {
    color: var(--text);
    position: relative; 
    border: 1px solid rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    background-color: var(--card);
    color: var(--text);
    margin-left: auto;
    padding: 0.5rem;
    overflow: visible; 
    margin-top: 5rem;
    margin-right: 1.5rem;
}

.popover-arrow {
    position: absolute;
    top: -12px;
    right: 8px;
    width: 24px;
    height: 12px;
    background-color: var(--card); 
    clip-path: polygon(0% 100%, 50% 0%, 100% 100%);
    border: 1px solid rgba(255, 255, 255, 0.03); 
    filter: brightness(150%);
    z-index: 10;
}

.dropdownOption {
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
}

.dropdownOption:hover {
    color: #ffffff;
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

    /* Full Screen Overlay */
    #primary-nav {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(5, 5, 5, 0.95);
        backdrop-filter: blur(12px);
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