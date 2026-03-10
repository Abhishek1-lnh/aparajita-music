/* ═══════════════════════════════════════════════════════════════
   🎵 MyMusic for Aparajita — Complete Application Logic
   Uses: JioSaavn API (saavn.dev) + YouTube IFrame API
   ═══════════════════════════════════════════════════════════════ */

// ======================== CONFIG ========================
const JIOSAAVN_API = 'https://saavn.dev/api';
// Fallback APIs (if main one is down)
const JIOSAAVN_FALLBACKS = [
    'https://saavn.dev/api',
    'https://jiosaavn-api-privatecvc2.vercel.app/api'
];
let activeAPI = JIOSAAVN_API;

// ======================== STATE ========================
let currentSong = null;       // Currently playing song object
let currentQueue = [];        // Current play queue
let currentQueueIndex = -1;   // Index in queue
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;           // 0=off, 1=all, 2=one
let searchSource = 'all';     // 'all', 'jiosaavn', 'youtube'
let currentPlayerType = null; // 'audio' or 'youtube'
let ytPlayerReady = false;
let ytPlayerObj = null;

// Storage
let playlist = JSON.parse(localStorage.getItem('mymusic_playlist') || '[]');
let favorites = JSON.parse(localStorage.getItem('mymusic_favorites') || '[]');
let history = JSON.parse(localStorage.getItem('mymusic_history') || '[]');

// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const progressBar = document.getElementById('progressBar');
const volumeBar = document.getElementById('volumeBar');

// ======================== SPLASH SCREEN ========================
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hidden');
    }, 1800);
    updatePlaylistCount();
    renderFloatingHearts();
    audioPlayer.volume = 0.8;
});

// ======================== YOUTUBE IFRAME API ========================
function onYouTubeIframeAPIReady() {
    ytPlayerObj = new YT.Player('ytPlayer', {
        height: '1',
        width: '1',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0
        },
        events: {
            onReady: () => { ytPlayerReady = true; console.log('YT Player Ready'); },
            onStateChange: onYTStateChange,
            onError: onYTError
        }
    });
}

function onYTStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        if (repeatMode === 2) {
            ytPlayerObj.seekTo(0);
            ytPlayerObj.playVideo();
        } else {
            nextSong();
        }
    }
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayButton();
        startYTProgressUpdater();
    }
    if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButton();
    }
}

function onYTError(event) {
    console.error('YT Error:', event.data);
    showToast('YouTube playback error. Trying next...', true);
    setTimeout(() => nextSong(), 1500);
}

let ytProgressInterval = null;
function startYTProgressUpdater() {
    clearInterval(ytProgressInterval);
    ytProgressInterval = setInterval(() => {
        if (ytPlayerObj && currentPlayerType === 'youtube' && isPlaying) {
            const current = ytPlayerObj.getCurrentTime() || 0;
            const total = ytPlayerObj.getDuration() || 0;
            if (total > 0) {
                progressBar.value = (current / total) * 100;
                progressBar.style.background = `linear-gradient(to right, #1db954 ${progressBar.value}%, #1a1a35 ${progressBar.value}%)`;
                document.getElementById('currentTime').textContent = formatTime(current);
                document.getElementById('totalTime').textContent = formatTime(total);
            }
        }
    }, 500);
}

// ======================== NAVIGATION ========================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    if (pageId === 'search') {
        setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
    }
    if (pageId === 'playlist') renderPlaylist();
    if (pageId === 'favorites') renderFavorites();
    if (pageId === 'history') renderHistory();

    // Close sidebar on mobile
    closeSidebar();
    window.scrollTo(0, 0);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

// ======================== SEARCH — JIOSAAVN ========================
async function searchJioSaavn(query) {
    for (const api of [activeAPI, ...JIOSAAVN_FALLBACKS]) {
        try {
            const res = await fetch(`${api}/search/songs?query=${encodeURIComponent(query)}&limit=20`);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.success && data.data && data.data.results) {
                activeAPI = api; // Remember working API
                return data.data.results.map(song => ({
                    id: song.id,
                    name: decodeHTML(song.name || ''),
                    artist: decodeHTML((song.artists?.primary?.map(a => a.name).join(', ')) || song.primaryArtists || 'Unknown Artist'),
                    album: decodeHTML(song.album?.name || ''),
                    duration: song.duration || 0,
                    image: getBestImage(song.image),
                    url: getBestAudioURL(song.downloadUrl),
                    source: 'jiosaavn',
                    year: song.year || '',
                    language: song.language || ''
                })).filter(s => s.url);
            }
        } catch (e) {
            console.warn('JioSaavn API error:', e);
        }
    }
    return [];
}

function getBestImage(images) {
    if (!images) return '';
    if (Array.isArray(images)) {
        const best = images.find(i => i.quality === '500x500') || images.find(i => i.quality === '150x150') || images[images.length - 1];
        return best?.url || best?.link || '';
    }
    return typeof images === 'string' ? images : '';
}

function getBestAudioURL(downloads) {
    if (!downloads) return '';
    if (Array.isArray(downloads)) {
        const best = downloads.find(d => d.quality === '320kbps') || downloads.find(d => d.quality === '160kbps') || downloads.find(d => d.quality === '96kbps') || downloads[downloads.length - 1];
        return best?.url || best?.link || '';
    }
    return typeof downloads === 'string' ? downloads : '';
}

// ======================== SEARCH — YOUTUBE ========================
async function searchYouTubeAPI(query) {
    // Using Invidious public API (no key needed)
    const instances = [
        'https://vid.puffyan.us',
        'https://invidious.fdn.fr',
        'https://y.com.sb',
        'https://invidious.nerdvpn.de'
    ];

    for (const instance of instances) {
        try {
            const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query + ' song')}&type=video&fields=videoId,title,author,lengthSeconds,videoThumbnails&sort_by=relevance`, {
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) continue;
            const data = await res.json();
            return data.filter(v => v.videoId).slice(0, 15).map(v => ({
                id: v.videoId,
                name: v.title || 'Unknown',
                artist: v.author || 'YouTube',
                album: 'YouTube',
                duration: v.lengthSeconds || 0,
                image: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
                url: v.videoId, // YouTube video ID
                source: 'youtube',
                year: '',
                language: ''
            }));
        } catch (e) {
            console.warn('Invidious error:', e);
        }
    }

    // Fallback: use piped API
    try {
        const res = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query + ' song')}&filter=music_songs`, {
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            return (data.items || []).filter(v => v.url).slice(0, 15).map(v => {
                const videoId = v.url?.replace('/watch?v=', '') || '';
                return {
                    id: videoId,
                    name: v.title || 'Unknown',
                    artist: v.uploaderName || 'YouTube',
                    album: 'YouTube',
                    duration: v.duration || 0,
                    image: v.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                    url: videoId,
                    source: 'youtube',
                    year: '',
                    language: ''
                };
            });
        }
    } catch (e) {
        console.warn('Piped API error:', e);
    }

    return [];
}

// ======================== MAIN SEARCH FUNCTION ========================
async function searchSongs(query) {
    if (!query || !query.trim()) {
        showToast('Please enter a search term', true);
        return;
    }
    query = query.trim();

    // Determine which results container to use
    const currentPage = document.querySelector('.page.active')?.id || 'page-search';
    let containerId = 'searchResults';
    if (currentPage === 'page-trending') containerId = 'trendingResults';
    else if (currentPage === 'page-hindi') containerId = 'hindiResults';
    else if (currentPage === 'page-bengali') containerId = 'bengaliResults';
    else if (currentPage === 'page-bollywood') containerId = 'bollywoodResults';

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

    let results = [];

    try {
        if (searchSource === 'jiosaavn') {
            results = await searchJioSaavn(query);
        } else if (searchSource === 'youtube') {
            results = await searchYouTubeAPI(query);
        } else {
            // Search both simultaneously
            const [saavnResults, ytResults] = await Promise.allSettled([
                searchJioSaavn(query),
                searchYouTubeAPI(query)
            ]);
            const saavn = saavnResults.status === 'fulfilled' ? saavnResults.value : [];
            const yt = ytResults.status === 'fulfilled' ? ytResults.value : [];
            // Interleave: mostly JioSaavn, some YouTube
            results = [...saavn.slice(0, 15), ...yt.slice(0, 5)];
        }
    } catch (e) {
        console.error('Search error:', e);
    }

    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><h3>No results found</h3><p>Try different keywords or switch source</p></div>`;
        return;
    }

    currentQueue = results;
    renderSongList(container, results);
}

async function searchYouTube(query) {
    if (!query || !query.trim()) return;
    const container = document.getElementById('youtubeResults');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching YouTube...</div>';

    const results = await searchYouTubeAPI(query);
    currentQueue = results;

    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fab fa-youtube" style="color:#ff0000;"></i><h3>No results</h3><p>Try different keywords</p></div>`;
        return;
    }
    renderSongList(container, results);
}

function quickSearch(query) {
    searchSongs(query);
    showPage('search');
    document.getElementById('searchInput').value = query;
}

function searchAndPlay(query) {
    searchJioSaavn(query).then(results => {
        if (results.length > 0) {
            playSong(results[0], results, 0);
        } else {
            // Fallback to YouTube
            searchYouTubeAPI(query).then(ytResults => {
                if (ytResults.length > 0) {
                    playSong(ytResults[0], ytResults, 0);
                } else {
                    showToast('Song not found', true);
                }
            });
        }
    });
}

// ======================== RENDER SONG LIST ========================
function renderSongList(container, songs) {
    container.innerHTML = songs.map((song, index) => {
        const isFav = favorites.some(f => f.id === song.id);
        const isInPlaylist = playlist.some(p => p.id === song.id);
        const isCurrentlyPlaying = currentSong && currentSong.id === song.id;

        return `
        <div class="song-item ${isCurrentlyPlaying ? 'playing' : ''}" onclick="playSong(currentQueue[${index}], currentQueue, ${index})">
            <img src="${song.image || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 50%22><rect fill=%22%231a1a2e%22 width=%2250%22 height=%2250%22 rx=%228%22/><text x=%2225%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%231db954%22 font-size=%2222%22>♪</text></svg>'}" 
                 class="song-thumbnail" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 50%22><rect fill=%22%231a1a2e%22 width=%2250%22 height=%2250%22 rx=%228%22/><text x=%2225%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%231db954%22 font-size=%2222%22>♪</text></svg>'">
            <div class="song-info">
                <p class="song-name">${escapeHTML(song.name)}</p>
                <p class="song-artist">${escapeHTML(song.artist)}${song.album && song.album !== 'YouTube' ? ' • ' + escapeHTML(song.album) : ''}</p>
            </div>
            <span class="song-duration">${song.duration ? formatTime(song.duration) : ''}</span>
            <span class="song-source ${song.source === 'jiosaavn' ? 'source-jiosaavn' : 'source-youtube'}">${song.source === 'jiosaavn' ? 'Saavn' : 'YT'}</span>
            <div class="song-actions" onclick="event.stopPropagation()">
                <button onclick="toggleFavorite(currentQueue[${index}])" title="Favorite">
                    <i class="${isFav ? 'fas' : 'far'} fa-heart" style="${isFav ? 'color:#ff6b9d' : ''}"></i>
                </button>
                <button onclick="addToPlaylist(currentQueue[${index}])" title="Add to Playlist">
                    <i class="fas ${isInPlaylist ? 'fa-check' : 'fa-plus'}" style="${isInPlaylist ? 'color:#1db954' : ''}"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ======================== PLAY SONG ========================
function playSong(song, queue, index) {
    if (!song) return;

    currentSong = song;
    currentQueue = queue || [song];
    currentQueueIndex = index >= 0 ? index : 0;

    // Update player UI
    document.getElementById('playerTitle').textContent = song.name;
    document.getElementById('playerArtist').textContent = song.artist;
    const img = document.getElementById('playerImg');
    if (song.image) {
        img.src = song.image;
        img.onerror = () => { img.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><rect fill='%231a1a2e' width='50' height='50' rx='8'/><text x='25' y='32' text-anchor='middle' fill='%231db954' font-size='22'>♪</text></svg>"; };
    }

    // Update like button
    const isFav = favorites.some(f => f.id === song.id);
    const likeBtn = document.getElementById('likeBtn');
    likeBtn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    likeBtn.classList.toggle('liked', isFav);

    // Highlight currently playing song in lists
    document.querySelectorAll('.song-item').forEach(el => el.classList.remove('playing'));

    // Play based on source
    if (song.source === 'youtube') {
        // Stop audio player
        audioPlayer.pause();
        audioPlayer.src = '';
        currentPlayerType = 'youtube';

        if (ytPlayerReady && ytPlayerObj) {
            ytPlayerObj.loadVideoById(song.url);
            ytPlayerObj.setVolume(volumeBar.value);
            isPlaying = true;
        } else {
            showToast('YouTube player loading, please wait...', false);
            setTimeout(() => {
                if (ytPlayerReady && ytPlayerObj) {
                    ytPlayerObj.loadVideoById(song.url);
                    ytPlayerObj.setVolume(volumeBar.value);
                    isPlaying = true;
                }
            }, 2000);
        }
    } else {
        // Stop YouTube player
        if (ytPlayerObj && ytPlayerReady) {
            try { ytPlayerObj.stopVideo(); } catch (e) { }
        }
        clearInterval(ytProgressInterval);
        currentPlayerType = 'audio';

        audioPlayer.src = song.url;
        audioPlayer.play().then(() => {
            isPlaying = true;
            updatePlayButton();
        }).catch(e => {
            console.error('Audio play error:', e);
            showToast('Playback error. Trying YouTube...', true);
            // Fallback: try YouTube for this song
            searchYouTubeAPI(song.name + ' ' + song.artist).then(ytResults => {
                if (ytResults.length > 0) {
                    ytResults[0].name = song.name;
                    ytResults[0].artist = song.artist;
                    ytResults[0].image = song.image;
                    playSong(ytResults[0], currentQueue, currentQueueIndex);
                }
            });
        });
    }

    updatePlayButton();
    addToHistory(song);

    // Media Session API (for notification controls)
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.name,
            artist: song.artist,
            album: song.album || 'MyMusic',
            artwork: song.image ? [{ src: song.image, sizes: '512x512', type: 'image/jpeg' }] : []
        });
        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());
    }
}

// ======================== PLAYER CONTROLS ========================
function togglePlay() {
    if (!currentSong) return;

    if (currentPlayerType === 'youtube' && ytPlayerObj) {
        if (isPlaying) {
            ytPlayerObj.pauseVideo();
        } else {
            ytPlayerObj.playVideo();
        }
        isPlaying = !isPlaying;
    } else {
        if (isPlaying) {
            audioPlayer.pause();
        } else {
            audioPlayer.play();
        }
        isPlaying = !isPlaying;
    }
    updatePlayButton();
}

function updatePlayButton() {
    const btn = document.getElementById('playBtn');
    btn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
}

function nextSong() {
    if (currentQueue.length === 0) return;

    let nextIndex;
    if (isShuffle) {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
    } else {
        nextIndex = currentQueueIndex + 1;
        if (nextIndex >= currentQueue.length) {
            if (repeatMode >= 1) nextIndex = 0;
            else return;
        }
    }
    playSong(currentQueue[nextIndex], currentQueue, nextIndex);
}

function prevSong() {
    if (currentQueue.length === 0) return;

    // If more than 3 seconds in, restart current song
    const currentTime = currentPlayerType === 'youtube' ?
        (ytPlayerObj?.getCurrentTime() || 0) : audioPlayer.currentTime;

    if (currentTime > 3) {
        seekTo(0);
        return;
    }

    let prevIndex = currentQueueIndex - 1;
    if (prevIndex < 0) prevIndex = currentQueue.length - 1;
    playSong(currentQueue[prevIndex], currentQueue, prevIndex);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    document.getElementById('shuffleBtn').classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Shuffle ON' : 'Shuffle OFF');
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', repeatMode > 0);
    const labels = ['Repeat OFF', 'Repeat ALL', 'Repeat ONE'];
    if (repeatMode === 2) btn.innerHTML = '<i class="fas fa-redo"></i><span style="font-size:8px;position:absolute;margin-top:8px;margin-left:-4px;">1</span>';
    else btn.innerHTML = '<i class="fas fa-redo"></i>';
    showToast(labels[repeatMode]);
}

function seekTo(value) {
    if (currentPlayerType === 'youtube' && ytPlayerObj) {
        const duration = ytPlayerObj.getDuration() || 0;
        ytPlayerObj.seekTo((value / 100) * duration, true);
    } else {
        if (audioPlayer.duration) {
            audioPlayer.currentTime = (value / 100) * audioPlayer.duration;
        }
    }
}

function setVolume(value) {
    const vol = value / 100;
    audioPlayer.volume = vol;
    if (ytPlayerObj && ytPlayerReady) {
        ytPlayerObj.setVolume(value);
    }
    updateVolumeIcon(value);
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        audioPlayer.dataset.prevVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeBar.value = 0;
        if (ytPlayerObj && ytPlayerReady) ytPlayerObj.mute();
    } else {
        audioPlayer.volume = parseFloat(audioPlayer.dataset.prevVolume || 0.8);
        volumeBar.value = audioPlayer.volume * 100;
        if (ytPlayerObj && ytPlayerReady) ytPlayerObj.unMute();
    }
    updateVolumeIcon(volumeBar.value);
}

function updateVolumeIcon(value) {
    const icon = document.getElementById('volumeIcon');
    if (value == 0) icon.innerHTML = '<i class="fas fa-volume-mute"></i>';
    else if (value < 50) icon.innerHTML = '<i class="fas fa-volume-down"></i>';
    else icon.innerHTML = '<i class="fas fa-volume-up"></i>';
}

// ======================== AUDIO PLAYER EVENTS ========================
audioPlayer.addEventListener('timeupdate', () => {
    if (currentPlayerType !== 'audio' || !audioPlayer.duration) return;
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = percent;
    progressBar.style.background = `linear-gradient(to right, #1db954 ${percent}%, #1a1a35 ${percent}%)`;
    document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);
    document.getElementById('totalTime').textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => {
    if (repeatMode === 2) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        nextSong();
    }
});

audioPlayer.addEventListener('error', () => {
    if (currentSong && currentPlayerType === 'audio') {
        showToast('Audio error. Trying YouTube...', true);
        searchYouTubeAPI(currentSong.name + ' ' + currentSong.artist).then(results => {
            if (results.length > 0) {
                results[0].name = currentSong.name;
                results[0].artist = currentSong.artist;
                results[0].image = currentSong.image;
                playSong(results[0], currentQueue, currentQueueIndex);
            }
        });
    }
});

// ======================== PLAYLIST MANAGEMENT ========================
function addToPlaylist(song) {
    if (!song) return;
    const exists = playlist.findIndex(s => s.id === song.id);
    if (exists >= 0) {
        playlist.splice(exists, 1);
        showToast('Removed from playlist');
    } else {
        playlist.push(song);
        showToast('Added to playlist! 🎵');
    }
    localStorage.setItem('mymusic_playlist', JSON.stringify(playlist));
    updatePlaylistCount();
}

function renderPlaylist() {
    const container = document.getElementById('myPlaylist');
    const actions = document.getElementById('playlistActions');

    if (playlist.length === 0) {
        actions.style.display = 'none';
        container.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><h3>Playlist is empty</h3><p>Search and tap + to add songs!</p></div>';
        return;
    }

    actions.style.display = 'flex';
    currentQueue = [...playlist];
    renderSongList(container, playlist);
}

function playAllPlaylist() {
    if (playlist.length > 0) {
        currentQueue = [...playlist];
        playSong(currentQueue[0], currentQueue, 0);
    }
}

function shufflePlaylist() {
    if (playlist.length > 0) {
        const shuffled = [...playlist].sort(() => Math.random() - 0.5);
        currentQueue = shuffled;
        playSong(shuffled[0], shuffled, 0);
        showToast('Shuffling playlist! 🔀');
    }
}

function clearPlaylist() {
    if (confirm('Clear entire playlist?')) {
        playlist = [];
        localStorage.setItem('mymusic_playlist', JSON.stringify(playlist));
        updatePlaylistCount();
        renderPlaylist();
        showToast('Playlist cleared');
    }
}

function updatePlaylistCount() {
    const badge = document.getElementById('playlistCount');
    if (badge) badge.textContent = playlist.length;
}

// ======================== FAVORITES ========================
function toggleFavorite(song) {
    if (!song) return;
    const index = favorites.findIndex(f => f.id === song.id);
    if (index >= 0) {
        favorites.splice(index, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push(song);
        showToast('Added to favorites! ❤️');
    }
    localStorage.setItem('mymusic_favorites', JSON.stringify(favorites));

    // Update like button if it's the current song
    if (currentSong && currentSong.id === song.id) {
        const isFav = favorites.some(f => f.id === song.id);
        const likeBtn = document.getElementById('likeBtn');
        likeBtn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
        likeBtn.classList.toggle('liked', isFav);
    }
}

function toggleCurrentLike() {
    if (currentSong) toggleFavorite(currentSong);
}

function renderFavorites() {
    const container = document.getElementById('myFavorites');
    if (favorites.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-heart" style="color:#ff6b9d;"></i><h3>No favorites yet</h3><p>Tap the heart on songs you love!</p></div>';
        return;
    }
    currentQueue = [...favorites];
    renderSongList(container, favorites);
}

// ======================== HISTORY ========================
function addToHistory(song) {
    if (!song) return;
    // Remove duplicates
    history = history.filter(h => h.id !== song.id);
    // Add to beginning
    history.unshift(song);
    // Keep only last 50
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('mymusic_history', JSON.stringify(history));
}

function renderHistory() {
    const container = document.getElementById('myHistory');
    if (history.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>No history yet</h3><p>Songs you play will appear here</p></div>';
        return;
    }
    currentQueue = [...history];
    renderSongList(container, history);
}

function clearHistory() {
    history = [];
    localStorage.setItem('mymusic_history', JSON.stringify(history));
    renderHistory();
    showToast('History cleared');
}

// ======================== APARAJITA PLAYLIST ========================
function playAparajitaPlaylist() {
    const songs = [
        'Lag Ja Gale Lata Mangeshkar',
        'Tujhe Dekha Toh Ye Jana Sanam',
        'Tum Hi Ho Arijit Singh',
        'Pehla Nasha Jo Jeeta Wohi Sikandar',
        'Pal Pal Dil Ke Paas Kishore Kumar',
        'Ami Chini Go Chini Tomare Rabindra Sangeet',
        'Tumi Robe Nirobe Rabindra Sangeet',
        'Channa Mereya Arijit Singh'
    ];

    showToast('Loading Aparajita playlist... 💕');

    // Search and play the first song, build queue from searches
    searchJioSaavn(songs[0]).then(results => {
        if (results.length > 0) {
            const firstSong = results[0];
            playSong(firstSong, [firstSong], 0);

            // Build full queue in background
            Promise.all(songs.slice(1).map(q => searchJioSaavn(q))).then(allResults => {
                const fullQueue = [firstSong];
                allResults.forEach(r => { if (r.length > 0) fullQueue.push(r[0]); });
                currentQueue = fullQueue;
                currentQueueIndex = 0;
                showToast(`Playing ${fullQueue.length} songs for Aparajita 💕`);
            });
        } else {
            showToast('Loading from YouTube...', false);
            searchAndPlay(songs[0]);
        }
    });
}

function renderFloatingHearts() {
    const container = document.getElementById('floatingHearts');
    if (!container) return;
    const hearts = ['💕', '❤️', '💗', '💖', '🌹', '💝', '♪', '♫'];
    for (let i = 0; i < 15; i++) {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.top = Math.random() * 100 + '%';
        heart.style.animationDelay = Math.random() * 5 + 's';
        heart.style.fontSize = (12 + Math.random() * 20) + 'px';
        container.appendChild(heart);
    }
}

// ======================== SEARCH FILTERS ========================
function setSearchSource(source, btn) {
    searchSource = source;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function highlightPreset(btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('button').forEach(b => b.classList.remove('preset-active'));
    btn.classList.add('preset-active');
}

// ======================== UTILITY FUNCTIONS ========================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    seconds = Math.floor(seconds);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function decodeHTML(html) {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { toast.className = 'toast'; }, 2500);
}

// ======================== KEYBOARD SHORTCUTS ========================
document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextSong();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            prevSong();
            break;
        case 'ArrowUp':
            e.preventDefault();
            volumeBar.value = Math.min(100, parseInt(volumeBar.value) + 10);
            setVolume(volumeBar.value);
            break;
        case 'ArrowDown':
            e.preventDefault();
            volumeBar.value = Math.max(0, parseInt(volumeBar.value) - 10);
            setVolume(volumeBar.value);
            break;
    }
});

console.log('🎵 MyMusic for Aparajita loaded! 💕');
