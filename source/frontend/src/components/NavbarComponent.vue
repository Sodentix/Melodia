<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';

const canvasRef = ref(null);
const isAuthenticated = ref(false);
let animationId;

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

// Code für die Wellenanimation
onMounted(() => {
  validateSession();
  window.addEventListener('melodia-auth-changed', handleAuthChange);

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');

  canvas.width = 800;
  canvas.height = 300;

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
    time += 0.018;
    const width = canvas.width;
    const height = canvas.height;
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
        <div id="logo">Melodia - Feel The Rythm.</div>
        <nav id="primary-nav">
            <ul class="nav-list">
            <li><router-link class="nav-link" :to="{ name: 'home' }">Home</router-link></li>
            <li><router-link class="nav-link" :to="{ path: '/home', hash: '#howtoplay' }">How to play</router-link></li>
            </ul>
            <div class="nav-actions">
            <router-link class="btn primary" v-if="!isAuthenticated" :to="{ name: 'auth' }">Sign Up</router-link>
            <router-link v-if="isAuthenticated" :to="{ name: 'profile' }">
              <div class="profile-orb">
                <Icon icon="solar:user-bold-duotone" class="userIcon"/>
              </div>
            </router-link>
            </div>
        </nav>
    </div>
</template>

<style scoped>
/* Allgemeine Navbar-Eigenschaften */
#navbar {
    display: flex;
    position: relative;
    flex-direction: row;
    background-color: black;
    height: 5rem;
    z-index: 999;
}

#primary-nav {
    display: flex;
    flex-direction: row;
    margin-left: 10rem;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
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
    padding-left: 2.5rem;
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
    padding-left: 5rem;
    padding-right: 2.5rem;
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

/* Iconify-Icon */
.profile-orb :deep(.userIcon) {
    font-size: 22px;
    color: white;
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7));
}

</style>