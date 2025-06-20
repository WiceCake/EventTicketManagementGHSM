import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/router.js'
import { useAuth } from './composables/useAuth'

// Set document title and favicon on route change
import ghsmLogo from '../src/assets/ghsm-normal.svg';

const app = createApp(App)
app.use(router)

const { initializeAuth, refreshAuth } = useAuth()

initializeAuth()

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshAuth()
  }
})

// Set document title and favicon on route change
router.afterEach((to) => {
  let pageTitle = 'GHSM';
  if (to.name && to.name !== 'NotFound') {
    // Use route name for title, capitalize first letter
    let routeName = to.name.charAt(0).toUpperCase() + to.name.slice(1);
    // Special cases for common names
    if (routeName === 'Home') pageTitle = 'GHSM | Home';
    else if (routeName === 'Login') pageTitle = 'GHSM | Login';
    else pageTitle = `GHSM | ${routeName.replace(/-/g, ' ')}`;
  }
  document.title = pageTitle;

  // Set favicon to ghsm-normal.svg
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = ghsmLogo;
});

app.mount('#app')
