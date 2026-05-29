// frontend/js/schedule.js
// Halaman jadwal rilis mingguan

const daysMap = {
    senin: { name: 'Senin', icon: 'fas fa-calendar-day' },
    selasa: { name: 'Selasa', icon: 'fas fa-calendar-day' },
    rabu: { name: 'Rabu', icon: 'fas fa-calendar-day' },
    kamis: { name: 'Kamis', icon: 'fas fa-calendar-day' },
    jumat: { name: 'Jumat', icon: 'fas fa-calendar-day' },
    sabtu: { name: 'Sabtu', icon: 'fas fa-calendar-day' },
    minggu: { name: 'Minggu', icon: 'fas fa-calendar-week' }
};

const daysOrder = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

let scheduleData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadSchedule();
    initBackButton();
});

async function loadSchedule() {
    const container = document.getElementById('schedule-grid');
    if (!container) return;

    try {
        const res = await API.fetchSchedule();
        
        if (!res || !res.success || !res.data) {
            container.innerHTML = `
                <div class="empty-day">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat jadwal. Silakan coba lagi nanti.</p>
                </div>
            `;
            return;
        }

        scheduleData = res.data;
        renderSchedule(scheduleData);
        
    } catch (error) {
        console.error('Failed to load schedule:', error);
        container.innerHTML = `
            <div class="empty-day">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Terjadi kesalahan saat memuat jadwal.</p>
                <button class="btn-primary" style="margin-top: 1rem;" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Coba Lagi
                </button>
            </div>
        `;
    }
}

function renderSchedule(data) {
    const container = document.getElementById('schedule-grid');
    if (!container) return;

    // Group data by day
    const grouped = {};
    daysOrder.forEach(day => { grouped[day] = []; });
    
    data.forEach(item => {
        const dayKey = item.day ? item.day.toLowerCase() : '';
        if (grouped[dayKey]) {
            grouped[dayKey].push(item);
        }
    });

    // Build HTML
    let html = '';
    for (const day of daysOrder) {
        const items = grouped[day];
        const dayInfo = daysMap[day];
        
        html += `
            <div class="schedule-day-card">
                <div class="schedule-day-header">
                    <h2>
                        <i class="${dayInfo.icon}"></i>
                        ${dayInfo.name}
                    </h2>
                </div>
                <div class="schedule-items-list">
        `;
        
        if (items.length === 0) {
            html += `
                <div class="empty-day">
                    <i class="fas fa-clock"></i>
                    <p>Tidak ada rilis hari ini</p>
                </div>
            `;
        } else {
            items.forEach(anime => {
                const updateBadge = anime.isUpdatedToday ? 
                    '<span class="update-badge"><i class="fas fa-check-circle"></i> Update Hari Ini</span>' : '';
                
                html += `
                    <div class="schedule-item" data-slug="${anime.slug}">
                        <div class="schedule-item-title">
                            <a href="anime.html?id=${anime.slug}">
                                ${escapeHtml(anime.title)}
                            </a>
                            ${updateBadge}
                        </div>
                        <div class="schedule-item-ep">
                            <i class="fas fa-play-circle"></i>
                            Episode ${anime.latestEpisode || '?'}
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Add click event to schedule items (redirect to anime detail)
    document.querySelectorAll('.schedule-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicked on link inside
            if (e.target.tagName === 'A') return;
            const slug = item.dataset.slug;
            if (slug) {
                window.location.href = `anime.html?id=${slug}`;
            }
        });
    });
}