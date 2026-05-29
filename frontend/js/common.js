// ━━━ file: frontend/js/common.js ━━━
/**
 * @file common.js
 * @description Modul inti frontend: storage keys, API client, bookmark, history, toast, skeleton,
 *              dan sekarang AUTHENTICATION (user state, dropdown, redirect protection)
 */

// ---------- STORAGE KEYS ----------
const STORAGE_KEYS = {
    THEME: 'zerostream_theme',
    LAYOUT: 'zerostream_layout',
    PAGINATION_MODE: 'zerostream_pagination_mode',
    WATCH_HISTORY: 'zerostream_history',
    BOOKMARKS: 'zerostream_bookmarks',
    DEFAULT_QUALITY: 'zerostream_quality'
};
window.STORAGE_KEYS = STORAGE_KEYS;

// ---------- GLOBAL STATE ----------
let allAnimeList = [];
let isOnline = navigator.onLine;
let currentUser = null; // { id, username, role, status }
let totalUsers = 0;

// ---------- API SERVICE (existing, ditambah fungsi auth) ----------
const API = {
    base: '/api',
    
    async fetchAllAnime() {
        const response = await fetch(`${this.base}/anime/all`);
        if (!response.ok) throw new Error('Failed to fetch anime list');
        const result = await response.json();
        return result.data;
    },
    
    async fetchAnimeById(id) {
        const response = await fetch(`${this.base}/anime/${id}`);
        if (!response.ok) throw new Error('Anime not found');
        const result = await response.json();
        return result.data;
    },
    
    async fetchGenres() {
        const response = await fetch(`${this.base}/anime/genres`);
        if (!response.ok) throw new Error('Failed to fetch genres');
        const result = await response.json();
        return result.data;
    },
    
    async fetchLatestEpisodes(limit = 12) {
        const response = await fetch(`${this.base}/anime/latest/episodes?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch latest episodes');
        const result = await response.json();
        return result.data;
    },

    async fetchNewReleases(limit = 12) {
        const response = await fetch(`${this.base}/anime/latest/anime?type=new_release&limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch new releases');
        const result = await response.json();
        return result.data;
    },

    async fetchRecentlyUpdated(limit = 12) {
        const response = await fetch(`${this.base}/anime/latest/anime?type=recently_updated&limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch recently updated');
        const result = await response.json();
        return result.data;
    },

    async fetchLiveFeed(limit = 30) {
        const response = await fetch(`${this.base}/anime/live-feed?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch live feed');
        const result = await response.json();
        return result.data;
    },

    async fetchSchedule() {
        const response = await fetch(`${this.base}/schedule`);
        if (!response.ok) throw new Error('Failed to fetch schedule');
        const result = await response.json();
        return result;
    },
    
    // ---------- AUTH METHODS ----------
    async getMe() {
        const response = await fetch(`${this.base}/auth/me`, { credentials: 'include' });
        if (!response.ok) {
            if (response.status === 401) return null;
            throw new Error('Failed to fetch user');
        }
        const result = await response.json();
        return result.success ? result : null;
    },
    
    async logout() {
        const response = await fetch(`${this.base}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.ok;
    }
};
window.API = API;

// ========== AUTHENTICATION CORE ==========

/**
 * Mendapatkan user saat ini dari server via /api/auth/me.
 * Juga mengupdate currentUser dan totalUsers.
 * @returns {Promise<object|null>}
 */
async function fetchCurrentUser() {
    try {
        const result = await API.getMe();
        if (result && result.user) {
            currentUser = result.user;
            totalUsers = result.totalUsers || 0;
            // Simpan ke localStorage untuk fallback cepat
            localStorage.setItem('zerostream_user', JSON.stringify(currentUser));
            localStorage.setItem('zerostream_totalUsers', totalUsers);
            return currentUser;
        } else {
            currentUser = null;
            localStorage.removeItem('zerostream_user');
            localStorage.removeItem('zerostream_totalUsers');
            return null;
        }
    } catch (err) {
        console.error('fetchCurrentUser error:', err);
        currentUser = null;
        return null;
    }
}

/**
 * Mendapatkan user dari memory (atau dari localStorage fallback).
 * @returns {object|null}
 */
function getCurrentUser() {
    if (currentUser) return currentUser;
    // fallback ke localStorage
    const stored = localStorage.getItem('zerostream_user');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch(e) {}
    }
    return null;
}

/**
 * Cek apakah user sudah login.
 * @returns {boolean}
 */
function isLoggedIn() {
    return !!getCurrentUser();
}

/**
 * Cek apakah user adalah admin.
 * @returns {boolean}
 */
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

/**
 * Logout: panggil API logout, bersihkan local state, reload ke login.
 */
async function logout() {
    try {
        await API.logout();
    } catch(e) {}
    currentUser = null;
    localStorage.removeItem('zerostream_user');
    localStorage.removeItem('zerostream_totalUsers');
    window.location.href = '/login.html';
}

/**
 * Redirect ke login jika belum login.
 * Jika sudah di halaman login, jangan loop.
 * @param {string} returnUrl - halaman tujuan setelah login
 */
function redirectToLogin(returnUrl) {
    if (window.location.pathname.includes('/login.html')) return;
    sessionStorage.setItem('login_redirect', returnUrl || window.location.pathname + window.location.search);
    window.location.href = '/login.html';
}

/**
 * Render user dropdown di header (dipanggil setelah DOM siap dan user terdeteksi)
 * Menampilkan username, role, total user, tombol logout, dan link admin jika admin.
 */
function renderUserDropdown() {
    const container = document.getElementById('user-dropdown-container');
    if (!container) return;
    
    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = '';
        return;
    }
    
    const total = totalUsers || parseInt(localStorage.getItem('zerostream_totalUsers')) || 0;
    const isAdminUser = user.role === 'admin';
    
    container.innerHTML = `
        <div class="user-dropdown">
            <button class="user-dropdown-trigger" id="user-dropdown-trigger">
                <i class="fas fa-user-circle"></i>
                <span class="user-name">${escapeHtml(user.username)}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="user-dropdown-menu" id="user-dropdown-menu">
                <div class="dropdown-info">
                    <i class="fas fa-id-badge"></i>
                    <div>
                        <strong>${escapeHtml(user.username)}</strong>
                        <span class="role-badge ${user.role}">${user.role}</span>
                    </div>
                </div>
                <div class="dropdown-stats">
                    <i class="fas fa-users"></i>
                    <span>Total users: ${total.toLocaleString()}</span>
                </div>
                ${isAdminUser ? `
                <a href="/admin.html" class="dropdown-item">
                    <i class="fas fa-shield-alt"></i> Admin Panel
                </a>
                ` : ''}
                <button class="dropdown-item logout-btn" id="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    `;
    
    // Event listeners untuk dropdown
    const trigger = document.getElementById('user-dropdown-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    if (trigger && menu) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
        document.addEventListener('click', () => {
            menu.classList.remove('open');
        });
        menu.addEventListener('click', (e) => e.stopPropagation());
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

/**
 * Inisialisasi auth: fetch user, render dropdown, dan proteksi halaman otomatis.
 * Dipanggil saat DOMContentLoaded di setiap halaman (kecuali login.html).
 */
async function initAuth() {
    // Cek apakah halaman ini adalah login.html? Jika ya, jangan proteksi
    if (window.location.pathname.includes('/login.html')) return;
    
    // Fetch user dari server
    const user = await fetchCurrentUser();
    if (!user) {
        redirectToLogin();
        return;
    }
    // Render dropdown
    renderUserDropdown();
    // Juga update totalUsers di dropdown jika ada perubahan (bisa dipanggil ulang nanti)
}

// ========== EXISTING FUNCTIONS (dari common.js asli, dipertahankan) ==========

async function loadAnimeData(forceRefresh = false) {
    if (window.allAnimeList && window.allAnimeList.length && !forceRefresh) return window.allAnimeList;
    try {
        const data = await API.fetchAllAnime();
        allAnimeList = data;
        window.allAnimeList = data;
        console.log(`✅ Loaded ${allAnimeList.length} anime`);
        return allAnimeList;
    } catch (error) {
        console.error('Failed to load anime data:', error);
        showToast('Gagal memuat data anime', 'error');
        return [];
    }
}

function getAnimeById(id) {
    return allAnimeList.find(anime => anime.id === id);
}

function getAllGenres() {
    const genresSet = new Set();
    allAnimeList.forEach(anime => {
        if (anime.info.genres && Array.isArray(anime.info.genres)) {
            anime.info.genres.forEach(g => genresSet.add(g));
        }
    });
    return Array.from(genresSet).sort();
}

// Watch History
function getWatchHistory() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY) || '[]');
}

function addToHistory(animeId, episodeNumber, animeTitle, episodeTitle) {
    let history = getWatchHistory();
    history = history.filter(item => item.animeId !== animeId);
    history.unshift({
        animeId,
        episodeNumber,
        animeTitle: animeTitle || 'Unknown',
        episodeTitle: episodeTitle || `Episode ${episodeNumber}`,
        timestamp: Date.now()
    });
    if (history.length > 100) history = history.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('historyUpdated'));
}

function removeHistoryItem(animeId) {
    let history = getWatchHistory();
    history = history.filter(item => item.animeId !== animeId);
    localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('historyUpdated'));
    showToast('Removed from history', 'info');
}

function clearHistory() {
    localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('historyUpdated'));
    showToast('History cleared', 'success');
}

function getLastWatchedEpisode(animeId) {
    const history = getWatchHistory();
    const entry = history.find(item => item.animeId === animeId);
    return entry ? entry.episodeNumber : null;
}

// Bookmarks
function getBookmarks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '[]');
}

function toggleBookmark(animeId, animeTitle) {
    let bookmarks = getBookmarks();
    const exists = bookmarks.some(b => b.id === animeId);
    if (exists) {
        bookmarks = bookmarks.filter(b => b.id !== animeId);
        showToast('Removed from bookmarks', 'info');
    } else {
        bookmarks.push({ id: animeId, title: animeTitle || 'Unknown', timestamp: Date.now() });
        showToast('Added to bookmarks', 'success');
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    window.dispatchEvent(new CustomEvent('bookmarksUpdated'));
    return !exists;
}

function isBookmarked(animeId) {
    const bookmarks = getBookmarks();
    return bookmarks.some(b => b.id === animeId);
}

// Toast
let toastContainer = null;
function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${escapeHtml(message)}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Skeleton
function showSkeleton(container, count = 12) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        skeleton.innerHTML = `
            <div class="skeleton-poster"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text" style="width: 60%"></div>
        `;
        container.appendChild(skeleton);
    }
}

function hideSkeleton(container) {
    if (!container) return;
    const skeletons = container.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
}

// Network monitor
function initNetworkListener() {
    window.addEventListener('online', () => {
        isOnline = true;
        showToast('Back online', 'success');
        window.dispatchEvent(new CustomEvent('networkOnline'));
    });
    window.addEventListener('offline', () => {
        isOnline = false;
        showToast('No internet connection', 'error');
        window.dispatchEvent(new CustomEvent('networkOffline'));
    });
}

// Mobile nav (existing)
function initMobileNav() {
    const hamburger = document.getElementById('hamburger-menu');
    const mobileNav = document.getElementById('mobile-nav');
    const closeNavBtn = document.getElementById('close-nav-btn');
    if (!hamburger || !mobileNav) return;
    
    function openNav() {
        mobileNav.hidden = false;
        mobileNav.classList.add('open');
        hamburger.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
    }
    
    function closeNav() {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        setTimeout(() => {
            if (!mobileNav.classList.contains('open')) mobileNav.hidden = true;
        }, 300);
    }
    
    hamburger.addEventListener('click', () => {
        if (mobileNav.classList.contains('open')) closeNav();
        else openNav();
    });
    if (closeNavBtn) closeNavBtn.addEventListener('click', closeNav);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('open')) closeNav();
    });
}

function initSearchToggle() {
    const searchToggle = document.getElementById('search-toggle-btn');
    const searchDrawer = document.getElementById('mobile-search-drawer');
    if (!searchToggle || !searchDrawer) return;
    searchToggle.addEventListener('click', () => {
        const isHidden = searchDrawer.hidden;
        searchDrawer.hidden = !isHidden;
        if (isHidden) {
            const input = searchDrawer.querySelector('#search-input');
            if (input) input.focus();
        }
    });
}

function initBackButton() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// ---------- INITIALIZE GLOBAL ACTIONS (MODIFIED) ----------
document.addEventListener('DOMContentLoaded', async () => {
    // Auth pertama: proteksi halaman dan render dropdown
    await initAuth();
    
    // Kemudian inisialisasi komponen lain yang tidak mengganggu auth
    initNetworkListener();
    initMobileNav();
    initSearchToggle();
    initBackButton();
});

// ---------- EXPOSE GLOBALS (tambah fungsi auth) ----------
window.allAnimeList = allAnimeList;
window.API = API;
window.loadAnimeData = loadAnimeData;
window.getAnimeById = getAnimeById;
window.getAllGenres = getAllGenres;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
window.toggleBookmark = toggleBookmark;
window.isBookmarked = isBookmarked;
window.getBookmarks = getBookmarks;
window.addToHistory = addToHistory;
window.getWatchHistory = getWatchHistory;
window.removeHistoryItem = removeHistoryItem;
window.clearHistory = clearHistory;
window.getLastWatchedEpisode = getLastWatchedEpisode;
window.debounce = debounce;

// Auth exports
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.isAdmin = isAdmin;
window.logout = logout;
window.fetchCurrentUser = fetchCurrentUser;