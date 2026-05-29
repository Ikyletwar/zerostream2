// ━━━ file: frontend/js/settings.js ━━━
/**
 * @file settings.js
 * @description Modul frontend untuk mengelola preferensi user seperti tema (dark/light),
 * layout (grid/list), mode paginasi, kualitas video default, serta panel pengaturan UI.
 */

(function () {
    // Gunakan STORAGE_KEYS dari window jika sudah di-define di common.js
    const keys = window.STORAGE_KEYS || {
        THEME: 'zerostream_theme',
        LAYOUT: 'zerostream_layout',
        PAGINATION_MODE: 'zerostream_pagination_mode',
        DEFAULT_QUALITY: 'zerostream_quality'
    };

    let settingsPanel = null;

    /**
     * Inisialisasi tema saat modul di-load.
     */
    function initTheme() {
        const savedTheme = localStorage.getItem(keys.THEME);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(theme);
    }

    /**
     * Mengubah tema aktif aplikasi.
     * @param {string} theme Tema ('dark' atau 'light').
     */
    function setTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem(keys.THEME, isDark ? 'dark' : 'light');
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === theme) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    /**
     * Mendapatkan preferensi layout (grid atau list).
     * @returns {string} Layout aktif.
     */
    function getLayoutPreference() {
        return localStorage.getItem(keys.LAYOUT) || 'grid';
    }

    /**
     * Mengatur preferensi layout dan memicu event global.
     * @param {string} layout Layout ('grid' atau 'list').
     */
    function setLayoutPreference(layout) {
        localStorage.setItem(keys.LAYOUT, layout);
        window.dispatchEvent(new CustomEvent('layoutChanged', { detail: layout }));
        document.querySelectorAll('.layout-mode-btn, .layout-btn').forEach(btn => {
            if (btn.dataset.layout === layout || btn.id === `${layout}-view-btn`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        const container = document.getElementById('anime-container');
        if (container) {
            if (layout === 'grid') {
                container.classList.remove('list-view');
                container.classList.add('grid-view');
            } else {
                container.classList.remove('grid-view');
                container.classList.add('list-view');
            }
        }
    }

    /**
     * Mendapatkan mode paginasi (pagination atau infinite).
     * @returns {string} Mode paginasi.
     */
    function getPaginationMode() {
        return localStorage.getItem(keys.PAGINATION_MODE) || 'pagination';
    }

    /**
     * Mengatur mode paginasi dan memicu event global.
     * @param {string} mode Mode paginasi.
     */
    function setPaginationMode(mode) {
        localStorage.setItem(keys.PAGINATION_MODE, mode);
        window.dispatchEvent(new CustomEvent('paginationModeChanged', { detail: mode }));
        document.querySelectorAll('.pagination-mode-btn').forEach(btn => {
            if (btn.dataset.mode === mode) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    /**
     * Mendapatkan preferensi kualitas video default.
     * @returns {string} Kualitas video.
     */
    function getDefaultQuality() {
        return localStorage.getItem(keys.DEFAULT_QUALITY) || '720p';
    }

    /**
     * Mengatur preferensi kualitas video default.
     * @param {string} quality Kualitas video ('360p', '480p', '720p', '1080p').
     */
    function setDefaultQuality(quality) {
        localStorage.setItem(keys.DEFAULT_QUALITY, quality);
        if (window.showToast) {
            window.showToast(`Default quality set to ${quality}`, 'info');
        }
        window.dispatchEvent(new CustomEvent('qualityChanged', { detail: quality }));
    }

    /**
     * Membuat panel UI preferences dan menambahkan event listener.
     */
    function createSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        if (!panel) return null;
        settingsPanel = panel;
        
        panel.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => setTheme(btn.dataset.theme));
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (btn.dataset.theme === currentTheme) btn.classList.add('active');
        });
        
        panel.querySelectorAll('.layout-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => setLayoutPreference(btn.dataset.layout));
            if (btn.dataset.layout === getLayoutPreference()) btn.classList.add('active');
        });
        
        panel.querySelectorAll('.pagination-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => setPaginationMode(btn.dataset.mode));
            if (btn.dataset.mode === getPaginationMode()) btn.classList.add('active');
        });
        
        panel.querySelectorAll('[data-quality]').forEach(btn => {
            btn.addEventListener('click', () => setDefaultQuality(btn.dataset.quality));
            if (btn.dataset.quality === getDefaultQuality()) btn.classList.add('active');
        });
        
        const closeBtn = panel.querySelector('#close-settings');
        if (closeBtn) closeBtn.addEventListener('click', () => closeSettings());
        return panel;
    }

    /**
     * Membuka panel preferensi UI.
     */
    function openSettings() {
        if (!settingsPanel) createSettingsPanel();
        if (settingsPanel) settingsPanel.classList.add('open');
    }

    /**
     * Menutup panel preferensi UI.
     */
    function closeSettings() {
        if (settingsPanel) settingsPanel.classList.remove('open');
    }

    // Inisialisasi tema sesegera mungkin
    initTheme();

    document.addEventListener('DOMContentLoaded', () => {
        createSettingsPanel();
        const settingsIcon = document.getElementById('settings-icon');
        if (settingsIcon) settingsIcon.addEventListener('click', openSettings);
    });

    // Expose ke global window object
    window.setTheme = setTheme;
    window.getLayoutPreference = getLayoutPreference;
    window.setLayoutPreference = setLayoutPreference;
    window.getPaginationMode = getPaginationMode;
    window.setPaginationMode = setPaginationMode;
    window.getDefaultQuality = getDefaultQuality;
    window.setDefaultQuality = setDefaultQuality;
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
})();
