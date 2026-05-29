// frontend/js/home.js
// ZeroStream - Home Page Module (Full Rewrite)
// Backend sorting, custom dropdowns, carousel, live feed, schedule, lazy loading

// ---------- STATE ----------
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentPaginationMode = 'pagination';
let infiniteScrollHandler = null;
let imageObserver = null;
let currentFilters = {
    sort: 'latest',
    genre: 'all',
    status: 'all',
    search: ''
};

// DOM Elements
let animeContainer, paginationContainer, loadMoreBtn, endMessage;
let filterGenreTrigger, filterStatusTrigger, filterSortTrigger;
let newReleaseContainer, latestEpisodeContainer, recentlyUpdatedContainer, liveFeedContainer;
let searchInput, searchSuggestionsContainer;

// ---------- INITIALIZATION ----------
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    animeContainer = document.getElementById('anime-container');
    paginationContainer = document.getElementById('pagination');
    loadMoreBtn = document.getElementById('load-more');
    endMessage = document.getElementById('end-message');
    filterGenreTrigger = document.getElementById('filter-genre-trigger');
    filterStatusTrigger = document.getElementById('filter-status-trigger');
    filterSortTrigger = document.getElementById('filter-sort-trigger');
    newReleaseContainer = document.getElementById('new-release-container');
    latestEpisodeContainer = document.getElementById('latest-episode-container');
    recentlyUpdatedContainer = document.getElementById('recently-updated-container');
    liveFeedContainer = document.getElementById('live-feed-list');
    searchInput = document.getElementById('search-input');
    searchSuggestionsContainer = document.getElementById('search-suggestions');

    // Initialize lazy loading
    initLazyLoading();

    // Load pagination mode from localStorage
    currentPaginationMode = getPaginationMode();

    // Layout toggle buttons
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    if (gridBtn && listBtn) {
        gridBtn.addEventListener('click', () => setLayoutPreference('grid'));
        listBtn.addEventListener('click', () => setLayoutPreference('list'));
        const layout = getLayoutPreference();
        if (layout === 'grid') gridBtn.classList.add('active');
        else listBtn.classList.add('active');
    }

    // --- Load genres for dropdown ---
    const genres = await loadGenres();

    // --- Custom Dropdown Helpers ---
    function closeAllDropdowns() {
        document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
    }
    function initCustomDropdown(triggerId, dropdownId, onChangeCallback) {
        const group = document.getElementById(triggerId)?.closest('.custom-select');
        const trigger = document.getElementById(triggerId);
        const dropdown = document.getElementById(dropdownId);
        if (!group || !trigger || !dropdown) return;
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = group.classList.contains('open');
            closeAllDropdowns();
            if (!wasOpen) group.classList.add('open');
        });
        dropdown.querySelectorAll('.select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                const label = item.textContent;
                const span = trigger.querySelector('.selected-value');
                if (span) span.textContent = label;
                dropdown.querySelectorAll('.select-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                group.classList.remove('open');
                if (onChangeCallback) onChangeCallback(value);
            });
        });
    }

    // Populate genre dropdown
    const genreDropdown = document.getElementById('filter-genre-dropdown');
    if (genreDropdown) {
        let html = '<div class="select-item" data-value="all">All Genres</div>';
        genres.forEach(g => {
            html += `<div class="select-item" data-value="${escapeHtml(g)}">${escapeHtml(g)}</div>`;
        });
        genreDropdown.innerHTML = html;
    }

    // Initialize dropdowns
    initCustomDropdown('filter-genre-trigger', 'filter-genre-dropdown', (value) => {
        currentFilters.genre = value;
        resetAndFetch();
    });
    initCustomDropdown('filter-status-trigger', 'filter-status-dropdown', (value) => {
        currentFilters.status = value;
        resetAndFetch();
    });
    initCustomDropdown('filter-sort-trigger', 'filter-sort-dropdown', (value) => {
        currentFilters.sort = value;
        resetAndFetch();
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select')) closeAllDropdowns();
    });

    // Set active initial values
    function setDropdownActive(dropdownId, value) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        dropdown.querySelectorAll('.select-item').forEach(item => {
            if (item.dataset.value === value) {
                item.classList.add('active');
                const group = item.closest('.custom-select');
                const trigger = group?.querySelector('.select-trigger');
                if (trigger) {
                    const span = trigger.querySelector('.selected-value');
                    if (span) span.textContent = item.textContent;
                }
            } else {
                item.classList.remove('active');
            }
        });
    }
    setDropdownActive('filter-genre-dropdown', currentFilters.genre);
    setDropdownActive('filter-status-dropdown', currentFilters.status);
    setDropdownActive('filter-sort-dropdown', currentFilters.sort);

    // Preset status from localStorage
    const presetStatus = localStorage.getItem('preset_status');
    if (presetStatus && (presetStatus === 'ongoing' || presetStatus === 'complete')) {
        currentFilters.status = presetStatus;
        setDropdownActive('filter-status-dropdown', currentFilters.status);
        localStorage.removeItem('preset_status');
        resetAndFetch();
    }

    // --- Search with debounce ---
    if (searchInput) {
        const debouncedSearch = debounce(() => {
            currentFilters.search = searchInput.value.trim();
            resetAndFetch();
        }, 300);
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
            if (query.length > 0) showAutocompleteSuggestions(query);
            else hideSuggestions();
            debouncedSearch();
        });
        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.trim();
            if (query.length > 0) showAutocompleteSuggestions(query);
        });
        searchInput.addEventListener('blur', () => setTimeout(() => hideSuggestions(), 200));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideSuggestions();
                searchInput.blur();
            }
        });
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                clearBtn.style.display = 'none';
                currentFilters.search = '';
                resetAndFetch();
                hideSuggestions();
                searchInput.focus();
            });
        }
    }

    // Layout & pagination mode listeners
    window.addEventListener('layoutChanged', () => renderCurrentPage());
    window.addEventListener('paginationModeChanged', () => {
        currentPaginationMode = getPaginationMode();
        resetAndFetch();
    });

    // Mobile filters
    document.querySelectorAll('.mobile-filter, .nav-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            if (status) {
                currentFilters.status = status;
                setDropdownActive('filter-status-dropdown', status);
                resetAndFetch();
                const mobileNav = document.getElementById('mobile-nav');
                if (mobileNav && mobileNav.classList.contains('open')) {
                    mobileNav.classList.remove('open');
                    const hamburger = document.getElementById('hamburger-menu');
                    if (hamburger) hamburger.classList.remove('active');
                }
            }
        });
    });

    // Load more button
    if (loadMoreBtn) {
        const btn = loadMoreBtn.querySelector('button');
        if (btn) btn.addEventListener('click', () => {
            if (!isLoading && currentPage < totalPages) {
                currentPage++;
                fetchAnimeAndRender(true);
            }
        });
    }

    // Load carousel, live feed, schedule
    await loadCarouselSections();
    await loadLiveFeed();
    await loadSchedule();

    // WebSocket events
    onRealtimeEvent('NEW_EPISODE', handleNewEpisodeEvent);
    onRealtimeEvent('ANIME_UPDATED', handleAnimeUpdatedEvent);
    onRealtimeEvent('REFRESH_CAROUSEL', () => {
        loadCarouselSections();
        loadLiveFeed();
    });

    // Initial fetch
    await resetAndFetch();
});

// ---------- LOAD GENRES ----------
async function loadGenres() {
    try {
        const res = await fetch('/api/genres');
        const data = await res.json();
        return data.data || [];
    } catch (error) {
        console.error('Failed to load genres', error);
        return [];
    }
}

// ---------- FETCH ANIME LIST FROM API ----------
async function fetchAnimeList(page = 1) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', 24);
    if (currentFilters.genre && currentFilters.genre !== 'all') params.append('genre', currentFilters.genre);
    if (currentFilters.status && currentFilters.status !== 'all') params.append('status', currentFilters.status);
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.sort) params.append('sort', currentFilters.sort);

    try {
        const response = await fetch(`/api/anime?${params.toString()}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result;
    } catch (error) {
        console.error('Fetch anime error:', error);
        showToast('Gagal memuat data anime', 'error');
        return { data: [], pagination: { total_pages: 0 } };
    }
}

async function fetchAnimeAndRender(append = false) {
    if (isLoading) return;
    isLoading = true;
    showSkeleton(animeContainer, 24);
    try {
        const result = await fetchAnimeList(currentPage);
        const items = result.data || [];
        totalPages = result.pagination?.total_pages || 0;
        renderAnimeCards(items, append);
        if (currentPaginationMode === 'infinite') {
            if (currentPage >= totalPages) {
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                if (endMessage) endMessage.style.display = 'block';
            } else {
                if (loadMoreBtn) loadMoreBtn.style.display = 'block';
                if (endMessage) endMessage.style.display = 'none';
            }
        } else {
            renderPaginationButtons(currentPage, totalPages);
        }
    } finally {
        isLoading = false;
        hideSkeleton(animeContainer);
    }
}

function resetAndFetch() {
    currentPage = 1;
    if (currentPaginationMode === 'infinite') {
        animeContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = 'block';
        if (endMessage) endMessage.style.display = 'none';
        setupInfiniteScroll();
    } else {
        if (paginationContainer) paginationContainer.style.display = 'flex';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        window.removeEventListener('scroll', infiniteScrollHandler);
    }
    fetchAnimeAndRender(false);
}

function renderCurrentPage() {
    fetchAnimeAndRender(false);
}

// ---------- INFINITE SCROLL ----------
function setupInfiniteScroll() {
    if (infiniteScrollHandler) window.removeEventListener('scroll', infiniteScrollHandler);
    infiniteScrollHandler = () => {
        if (isLoading || currentPage >= totalPages) return;
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        if (scrollTop + windowHeight >= docHeight - 400) {
            currentPage++;
            fetchAnimeAndRender(true);
        }
    };
    window.addEventListener('scroll', infiniteScrollHandler);
}

// ---------- PAGINATION BUTTONS ----------
function renderPaginationButtons(current, total) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    if (total <= 1) return;

    const prev = document.createElement('button');
    prev.innerHTML = '<i class="fas fa-chevron-left"></i> Prev';
    prev.disabled = current === 1;
    prev.addEventListener('click', () => {
        if (current > 1) {
            currentPage = current - 1;
            fetchAnimeAndRender(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationContainer.appendChild(prev);

    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(total, current + 2);
    if (endPage - startPage < 4) {
        if (startPage === 1) endPage = Math.min(total, startPage + 4);
        else startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => goToPage(1));
        paginationContainer.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 0.5rem';
            paginationContainer.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === current) btn.classList.add('active');
        btn.addEventListener('click', () => goToPage(i));
        paginationContainer.appendChild(btn);
    }

    if (endPage < total) {
        if (endPage < total - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 0.5rem';
            paginationContainer.appendChild(ellipsis);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = total;
        lastBtn.addEventListener('click', () => goToPage(total));
        paginationContainer.appendChild(lastBtn);
    }

    const next = document.createElement('button');
    next.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
    next.disabled = current === total;
    next.addEventListener('click', () => {
        if (current < total) {
            currentPage = current + 1;
            fetchAnimeAndRender(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationContainer.appendChild(next);

    function goToPage(page) {
        currentPage = page;
        fetchAnimeAndRender(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ---------- RENDER ANIME CARDS (with lazy loading) ----------
function renderAnimeCards(items, append = false) {
    const layout = getLayoutPreference();
    const container = animeContainer;
    if (!append) container.innerHTML = '';
    if (items.length === 0 && !append) {
        container.innerHTML = '<div class="no-results"><i class="fas fa-frown"></i> No anime found. Try changing filters.</div>';
        return;
    }
    items.forEach(anime => {
        const card = document.createElement('div');
        card.className = `anime-card ${layout === 'list' ? 'list-view' : ''}`;
        const posterUrl = anime.poster_url || 'https://via.placeholder.com/300x450?text=No+Image';
        const rating = anime.rating ? `<i class="fas fa-star"></i> ${anime.rating}` : '';
        const statusClass = anime.status === 'ongoing' ? 'ongoing' : 'complete';
        const statusText = anime.status === 'ongoing' ? 'Ongoing' : 'Complete';
        card.innerHTML = `
            <div class="card-poster">
                <img data-src="${posterUrl}" alt="${escapeHtml(anime.title)}" loading="lazy" class="lazy">
                <div class="card-status ${statusClass}">${statusText}</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">${escapeHtml(anime.title)}</h3>
                ${layout === 'list' ? `<p class="card-synopsis">${escapeHtml((anime.synopsis || '').substring(0, 120))}${anime.synopsis?.length > 120 ? '...' : ''}</p>` : ''}
                <div class="card-meta">
                    <span class="card-rating">${rating}</span>
                    <span class="card-episodes"><i class="fas fa-play-circle"></i> ${anime.info.total_episodes || 0} eps</span>
                </div>
                <div class="card-genres">${(anime.info.genres || []).slice(0, 3).join(', ')}</div>
            </div>
        `;
        card.addEventListener('click', () => {
            window.location.href = `anime.html?id=${anime.id}`;
        });
        container.appendChild(card);
    });
    if (imageObserver) observeImages(container);
}

// ---------- LAZY LOADING (Intersection Observer) ----------
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc) {
                        img.src = dataSrc;
                        img.removeAttribute('data-src');
                        img.classList.add('loaded');
                    }
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '100px', threshold: 0.01 });
    }
}

function observeImages(container) {
    if (!imageObserver) return;
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => imageObserver.observe(img));
}

// ---------- SKELETON LOADER ----------
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

// ---------- AUTOCOMPLETE SUGGESTIONS (client-side, hanya berdasarkan allAnimeList yang sudah di-load dari common.js) ----------
async function showAutocompleteSuggestions(query) {
    if (!searchSuggestionsContainer) return;
    // Ensure allAnimeList is loaded (common.js already loads it, but if not, we load it)
    if (!window.allAnimeList || window.allAnimeList.length === 0) {
        await loadAnimeData();
    }
    const matches = (window.allAnimeList || []).filter(anime => anime.title.toLowerCase().includes(query.toLowerCase())).slice(0, 7);
    if (matches.length === 0) {
        hideSuggestions();
        return;
    }
    searchSuggestionsContainer.innerHTML = matches.map(anime => `
        <div class="suggestion-item" data-id="${anime.id}">
            <i class="fas fa-search"></i>
            <span>${escapeHtml(anime.title)}</span>
            <small>${anime.info.total_episodes || 0} eps</small>
        </div>
    `).join('');
    searchSuggestionsContainer.style.display = 'block';
    document.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const animeId = item.dataset.id;
            if (animeId) window.location.href = `anime.html?id=${animeId}`;
        });
    });
}

function hideSuggestions() {
    if (searchSuggestionsContainer) {
        searchSuggestionsContainer.style.display = 'none';
        searchSuggestionsContainer.innerHTML = '';
    }
}

// ---------- CAROUSEL SECTIONS ----------
async function loadCarouselSections() {
    try {
        showSkeletonCarousel(newReleaseContainer);
        const newReleases = await API.fetchNewReleases(12);
        renderCarousel(newReleaseContainer, newReleases, 'anime');

        showSkeletonCarousel(latestEpisodeContainer);
        const latestEpisodes = await API.fetchLatestEpisodes(12);
        renderCarousel(latestEpisodeContainer, latestEpisodes, 'episode');

        showSkeletonCarousel(recentlyUpdatedContainer);
        const recentlyUpdated = await API.fetchRecentlyUpdated(12);
        renderCarousel(recentlyUpdatedContainer, recentlyUpdated, 'anime');
    } catch (error) {
        console.error('Failed to load carousel sections:', error);
        showToast('Failed to load carousel data', 'error');
    }
}

function showSkeletonCarousel(container) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'carousel-card skeleton-carousel';
        skeleton.innerHTML = '<div class="skeleton-poster"></div><div class="skeleton-title"></div>';
        container.appendChild(skeleton);
    }
}

function renderCarousel(container, items, type) {
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="carousel-empty">No data available</div>';
        return;
    }
    container.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'carousel-card';
        if (type === 'episode') {
            const poster = item.poster_url || 'https://via.placeholder.com/300x450';
            card.innerHTML = `
                <div class="carousel-poster">
                    <img data-src="${poster}" alt="${escapeHtml(item.anime_title)}" loading="lazy" class="lazy">
                    <div class="carousel-ep-badge">EP ${item.episode_number}</div>
                </div>
                <div class="carousel-info">
                    <div class="carousel-title">${escapeHtml(item.anime_title)}</div>
                    <div class="carousel-sub">${escapeHtml(item.episode_title || `Episode ${item.episode_number}`)}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `anime.html?id=${item.anime_id}&ep=${item.episode_number}`;
            });
        } else {
            const poster = item.poster_url || 'https://via.placeholder.com/300x450';
            card.innerHTML = `
                <div class="carousel-poster">
                    <img data-src="${poster}" alt="${escapeHtml(item.title)}" loading="lazy" class="lazy">
                    <div class="carousel-status ${item.status}">${item.status === 'ongoing' ? 'Ongoing' : 'Complete'}</div>
                </div>
                <div class="carousel-info">
                    <div class="carousel-title">${escapeHtml(item.title)}</div>
                    <div class="carousel-sub">${item.total_episodes || 0} eps</div>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `anime.html?id=${item.id}`;
            });
        }
        container.appendChild(card);
    });
    if (imageObserver) observeImages(container);
}

// ---------- LIVE FEED ----------
async function loadLiveFeed() {
    if (!liveFeedContainer) return;
    try {
        liveFeedContainer.innerHTML = '<div class="live-feed-loading"><i class="fas fa-spinner fa-pulse"></i> Loading feed...</div>';
        const events = await API.fetchLiveFeed(30);
        renderLiveFeed(events);
    } catch (error) {
        console.error('Failed to load live feed:', error);
        liveFeedContainer.innerHTML = '<div class="live-feed-empty">Unable to load feed</div>';
    }
}

function renderLiveFeed(events) {
    if (!liveFeedContainer) return;
    if (!events || events.length === 0) {
        liveFeedContainer.innerHTML = '<div class="live-feed-empty">No events yet</div>';
        return;
    }
    liveFeedContainer.innerHTML = '';
    events.forEach(event => {
        const item = document.createElement('div');
        item.className = 'live-feed-item';
        const time = new Date(event.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        item.innerHTML = `
            <span class="live-feed-time">${time}</span>
            <span class="live-feed-message">${escapeHtml(event.message)}</span>
        `;
        if (event.anime_id) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                window.location.href = `anime.html?id=${event.anime_id}`;
            });
        }
        liveFeedContainer.appendChild(item);
    });
}

function prependLiveFeedEvent(message, animeId = null) {
    if (!liveFeedContainer) return;
    const item = document.createElement('div');
    item.className = 'live-feed-item';
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    item.innerHTML = `
        <span class="live-feed-time">${time}</span>
        <span class="live-feed-message">${escapeHtml(message)}</span>
    `;
    if (animeId) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            window.location.href = `anime.html?id=${animeId}`;
        });
    }
    liveFeedContainer.prepend(item);
    while (liveFeedContainer.children.length > 50) {
        liveFeedContainer.removeChild(liveFeedContainer.lastChild);
    }
}

// ---------- WEBSOCKET HANDLERS ----------
function handleNewEpisodeEvent(event) {
    const { animeId, animeTitle, episodeNumber, message } = event.data;
    prependLiveFeedEvent(message, animeId);
    refreshLatestEpisodesCarousel();
    refreshRecentlyUpdatedCarousel();
    showToast(`${animeTitle} Episode ${episodeNumber} added!`, 'info', 4000);
}

function handleAnimeUpdatedEvent(event) {
    const { animeId, animeTitle, message } = event.data;
    prependLiveFeedEvent(message, animeId);
    refreshRecentlyUpdatedCarousel();
}

async function refreshLatestEpisodesCarousel() {
    try {
        const latest = await API.fetchLatestEpisodes(12);
        renderCarousel(latestEpisodeContainer, latest, 'episode');
    } catch (e) { console.error(e); }
}

async function refreshRecentlyUpdatedCarousel() {
    try {
        const updated = await API.fetchRecentlyUpdated(12);
        renderCarousel(recentlyUpdatedContainer, updated, 'anime');
    } catch (e) { console.error(e); }
}

// ---------- SCHEDULE (Homepage tidak digunakan lagi, tapi tetap dipanggil? Boleh dihapus jika tidak ingin) ----------
async function loadSchedule() {
    // Schedule sudah dipisah ke halaman sendiri, jadi tidak perlu di home. Biarkan kosong atau hapus.
    // Tapi karena di index.html masih ada elemen schedule-container, kita kosongkan saja.
    const scheduleContainer = document.querySelector('.schedule-container');
    if (scheduleContainer) scheduleContainer.innerHTML = '<div class="error">Jadwal pindah ke halaman Schedule</div>';
}