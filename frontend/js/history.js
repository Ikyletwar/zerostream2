// frontend/js/history.js
// Halaman riwayat tontonan

let historyItems = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();
    initBackButton();
    
    // Listen for history updates from other pages
    window.addEventListener('historyUpdated', () => {
        loadHistory();
    });
    
    // Clear all button
    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Hapus semua riwayat tontonan?')) {
                clearHistory();
                loadHistory();
            }
        });
    }
});

async function loadHistory() {
    const container = document.getElementById('history-list');
    const countSpan = document.getElementById('history-count');
    
    if (!container) return;
    
    historyItems = getWatchHistory();
    
    if (countSpan) {
        countSpan.textContent = `${historyItems.length} ${historyItems.length === 1 ? 'anime' : 'anime'}`;
    }
    
    if (historyItems.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-tv"></i>
                <p>Belum ada riwayat tontonan</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">Mulai streaming anime untuk menyimpan riwayat</p>
            </div>
        `;
        return;
    }
    
    // Fetch anime details for posters
    await loadAnimeData();
    
    let html = '';
    for (const item of historyItems) {
        const anime = getAnimeById(item.animeId);
        const posterUrl = anime?.poster_url || 'https://via.placeholder.com/60x90?text=No+Image';
        const animeTitle = item.animeTitle || anime?.title || 'Unknown';
        const timeStr = formatTimeAgo(item.timestamp);
        
        html += `
            <div class="history-item" data-anime-id="${item.animeId}" data-episode="${item.episodeNumber}">
                <div class="history-item-poster">
                    <img src="${posterUrl}" alt="${escapeHtml(animeTitle)}" loading="lazy">
                </div>
                <div class="history-item-info">
                    <div class="history-item-title">${escapeHtml(animeTitle)}</div>
                    <div class="history-item-episode">
                        <i class="fas fa-play-circle"></i>
                        Episode ${item.episodeNumber}
                        <span class="history-item-time">• ${timeStr}</span>
                    </div>
                </div>
                <button class="remove-history-btn" data-anime-id="${item.animeId}" title="Hapus dari riwayat">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Add click event to history items
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicked on remove button
            if (e.target.closest('.remove-history-btn')) return;
            
            const animeId = item.dataset.animeId;
            const episode = item.dataset.episode;
            if (animeId) {
                window.location.href = `anime.html?id=${animeId}&ep=${episode}`;
            }
        });
    });
    
    // Add remove button events
    document.querySelectorAll('.remove-history-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const animeId = btn.dataset.animeId;
            if (animeId) {
                removeHistoryItem(animeId);
                loadHistory(); // reload after removal
            }
        });
    });
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'baru saja';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} minggu lalu`;
    const months = Math.floor(days / 30);
    return `${months} bulan lalu`;
}