// ━━━ file: frontend/js/websocket.js ━━━
/**
 * @file websocket.js
 * @description Modul frontend untuk mengelola koneksi WebSocket real-time dengan server,
 * menangani reconnect otomatis, dan menyebarkan event (seperti episode baru dirilis).
 */

(function () {
    let socket = null;
    const eventHandlers = new Map();

    /**
     * Memulai koneksi WebSocket ke server.
     */
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('🔌 WebSocket connected');
            if (window.showToast) {
                window.showToast('Real-time feed aktif', 'success', 2000);
            }
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📡 WebSocket event:', data);
                handleRealtimeEvent(data);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        socket.onclose = () => {
            console.log('🔌 WebSocket disconnected, reconnecting in 5s...');
            setTimeout(connectWebSocket, 5000);
        };
    }

    /**
     * Memproses event WebSocket real-time dan meneruskannya ke callback terdaftar.
     * @param {Object} event Objek event dari server.
     */
    function handleRealtimeEvent(event) {
        if (eventHandlers.has(event.type)) {
            eventHandlers.get(event.type).forEach(cb => cb(event));
        }
        if (window.showToast) {
            if (event.type === 'NEW_EPISODE') {
                window.showToast(`${event.data.animeTitle} Episode ${event.data.episodeNumber} added!`, 'info', 4000);
            } else if (event.type === 'ANIME_UPDATED') {
                window.showToast(`${event.data.animeTitle} updated`, 'info', 3000);
            }
        }
    }

    /**
     * Mendaftarkan callback untuk event tipe tertentu.
     * @param {string} eventType Tipe event (misal: 'NEW_EPISODE').
     * @param {Function} callback Fungsi callback.
     */
    function onRealtimeEvent(eventType, callback) {
        if (!eventHandlers.has(eventType)) {
            eventHandlers.set(eventType, []);
        }
        eventHandlers.get(eventType).push(callback);
    }

    document.addEventListener('DOMContentLoaded', () => {
        connectWebSocket();
    });

    // Expose ke global window object
    window.onRealtimeEvent = onRealtimeEvent;
})();
