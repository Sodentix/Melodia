<template>
    <div id="navbar">
        <div id="logo">Melodia - Feel The Rythm.</div>
        <nav id="primary-nav">
            <ul class="nav-list">
            <li><router-link class="nav-link" :to="{ name: 'home' }">Home</router-link></li>
            <li><router-link class="nav-link" :to="{ path: '/home', hash: '#howtoplay' }">How to play</router-link></li>
            </ul>
            <div class="nav-actions">
            <button class="btn primary"><router-link class="nav-link" :to="{ name: 'profile' }">Sign Up</router-link></button>
            </div>
        </nav>
    </div>
</template>

<style scoped>
#navbar {
    display: flex;
    flex-direction: row;
    background-color: black;
    height: 5rem;
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
.nav-list {
    display: flex;
    gap: 2rem;
    list-style: none;
    text-decoration: none;
}

.nav-link {
    text-decoration: none;
    color: var(--text);
    font-weight: 600;
    letter-spacing: 0.04em;
    transition: color 0.22s ease;
    font-size: 1.1rem;
}

.nav-link:hover {
  text-decoration: underline;
}


.nav-actions {
    padding-left: 5rem;
}

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
    }
    .btn.primary {
      border: none;
      background: linear-gradient(100deg, var(--accent-pink), var(--accent-cyan));
      box-shadow: 0 10px 32px rgba(255,0,200,0.18);
      color: #050505;
    }
    .btn.primary:hover { transform: translateY(-2px); }
    .btn.ghost:hover {
      border-color: rgba(255,255,255,0.24);
      background: rgba(255,255,255,0.08);
    }
</style>