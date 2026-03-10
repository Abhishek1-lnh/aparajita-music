# 🎵 MyMusic - For Aparajita 💕

A beautifully crafted, ad-free Progressive Web App (PWA) music player built exclusively for streaming Hindi and Bengali songs. This is a personal project designed with love, offering a completely custom interface, unlimited songs, and seamless playback using JioSaavn and YouTube APIs as backend sources.

## ✨ Features

- **Personalized Experience**: Built as a dedicated app with customized "Aparajita" playlists, greetings, and design elements.
- **Dual API Integration**: Streams music from JioSaavn and falls back to YouTube APIs for comprehensive coverage.
- **Ad-Free & Unlimited**: No interruptions, no ads, just pure music everywhere you go.
- **PWA Ready**: Installable on Android, iOS, and Desktop as a standalone application. Full caching via Service Workers.
- **Rich Media Controls**: Includes play, pause, shuffle, repeat (all/one), and volume settings, integrated with the Media Session API.
- **Library Management**: 'Favorites', 'Playlists', and 'Recently Played History' persisted via Local Storage.

## 🚀 Setup & Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/aparajita-music.git
   ```

2. **Run locally:**
   Since this is a client-side project, you can simply open `index.html` in your browser. For PWA features (like the Service Worker) to function properly during development, run it on a local server (e.g., using VS Code Live Server or Node's `http-server`).
   ```bash
   npx http-server
   ```

3. **Deploy to GitHub Pages:**
   This project is completely static (HTML, CSS, JS) and is perfectly suited for direct deployment via GitHub Pages. Just commit these files to the `main` branch and enable GitHub Pages in your repository settings!

## 📂 Project Structure

```text
├── index.html       # The main PWA application shell & UI
├── style.css        # All styling, responsive design, and CSS animations
├── app.js           # Core music player logic, API fetching, & routing
├── sw.js            # Service worker for offline asset caching
└── manifest.json    # Web App Manifest for mobile installation
```

## ⚠️ Notes for Progressive Web App (PWA) Install

Chrome and Android prefer actual `.png` icons for PWA installation rather than `data:image/svg+xml`. If you face issues where the app prompt doesn't show up on Android, consider replacing the SVG strings in `manifest.json` with URLs pointing to actual `192x192.png` and `512x512.png` image files hosted alongside your `index.html`.

---
*Made with ❤️ for Aparajita*
