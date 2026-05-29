// ━━━ file: frontend/js/about.js ━━━
/**
 * @file about.js
 * @description Halaman About ZeroStream — Super premium, lengkap, animasi elegan.
 * Fitur: counter statistik, scroll reveal, carousel, accordion FAQ, progress bar, back to top.
 */

(function () {
    'use strict';

    // ========== DOM Elements ==========
    const statsContainer = document.getElementById('stats-container');
    const footerTotalAnime = document.getElementById('footerTotalAnime');
    const footerTotalEpisodes = document.getElementById('footerTotalEpisodes');
    const footerLastUpdated = document.getElementById('footerLastUpdated');

    // Counter elements
    const statTotalAnimeEl = document.getElementById('statTotalAnime');
    const statTotalEpisodesEl = document.getElementById('statTotalEpisodes');
    const statOngoingEl = document.getElementById('statOngoing');
    const statCompleteEl = document.getElementById('statComplete');
    const statLastUpdatedEl = document.getElementById('statLastUpdated');

    // Carousel
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');

    // Progress & back to top
    const progressBar = document.getElementById('scrollProgress');
    const backToTopBtn = document.getElementById('backToTopBtn');

    // State
    let currentSlide = 0;
    let totalSlides = 0;
    let statsData = null;
    let counterStarted = false;

    // ========== Helper: Format tanggal ==========
    function formatLastUpdated(timestamp) {
        if (!timestamp || isNaN(timestamp)) return 'Belum ada';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Belum ada';
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    // ========== Counter Animation (count-up) ==========
    function animateCounter(element, target, duration = 1500) {
        if (!element) return;
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString('id-ID');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString('id-ID');
            }
        }, 16);
    }

    function startCounters() {
        if (!statsData) return;
        const stats = statsData.stats || statsData;
        const totalAnime = stats.total_anime || 0;
        const totalEpisodes = stats.total_episodes || 0;
        const ongoing = stats.ongoing_anime || 0;
        const complete = stats.complete_anime || 0;
        const lastUpdatedRaw = stats.last_updated || null;

        animateCounter(statTotalAnimeEl, totalAnime);
        animateCounter(statTotalEpisodesEl, totalEpisodes);
        animateCounter(statOngoingEl, ongoing);
        animateCounter(statCompleteEl, complete);

        if (statLastUpdatedEl) {
            statLastUpdatedEl.textContent = formatLastUpdated(lastUpdatedRaw);
        }

        // Update footer metrics
        if (footerTotalAnime) footerTotalAnime.textContent = totalAnime.toLocaleString('id-ID');
        if (footerTotalEpisodes) footerTotalEpisodes.textContent = totalEpisodes.toLocaleString('id-ID');
        if (footerLastUpdated) footerLastUpdated.textContent = formatLastUpdated(lastUpdatedRaw);
    }

    // ========== Fetch Stats from API ==========
    async function fetchStats() {
        try {
            const response = await fetch('/api/anime/stats');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Invalid response');
            statsData = result;
            startCounters();
        } catch (error) {
            console.error('[About] Failed to load stats:', error);
            if (statTotalAnimeEl) statTotalAnimeEl.textContent = 'Error';
            if (footerTotalAnime) footerTotalAnime.textContent = '—';
        }
    }

    // ========== Intersection Observer untuk Counter (trigger sekali) ==========
    function initCounterObserver() {
        const statsSection = document.getElementById('statsSection');
        if (!statsSection || counterStarted) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !counterStarted) {
                    counterStarted = true;
                    fetchStats();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.3 });
        observer.observe(statsSection);
    }

    // ========== Scroll Reveal (semua elemen dengan class .scroll-reveal) ==========
    function initScrollReveal() {
        const revealElements = document.querySelectorAll('.scroll-reveal');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });

        revealElements.forEach(el => observer.observe(el));

        // Stagger children (untuk grid fitur dan stat card container)
        const staggerParents = document.querySelectorAll('.stagger-children');
        staggerParents.forEach(parent => {
            observer.observe(parent);
        });
    }

    // ========== Progress Scroll Bar & Back to Top ==========
    function initScrollProgress() {
        if (!progressBar) return;
        window.addEventListener('scroll', () => {
            const winScroll = document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (winScroll / height) * 100;
            progressBar.style.width = scrolled + '%';

            // Back to top visibility
            if (backToTopBtn) {
                if (winScroll > 300) {
                    backToTopBtn.classList.add('visible');
                } else {
                    backToTopBtn.classList.remove('visible');
                }
            }
        });

        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    // ========== Carousel Gallery ==========
    function initCarousel() {
        if (!track || !prevBtn || !nextBtn) return;
        const slides = track.querySelectorAll('.carousel-slide');
        totalSlides = slides.length;
        if (totalSlides === 0) return;

        const slideWidth = 100; // persen
        function updateCarousel() {
            track.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
        }

        prevBtn.addEventListener('click', () => {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            updateCarousel();
        });

        nextBtn.addEventListener('click', () => {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateCarousel();
        });
    }

    // ========== FAQ Accordion ==========
    function initFaqAccordion() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const questionBtn = item.querySelector('.faq-question');
            if (!questionBtn) return;
            questionBtn.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                // Tutup semua yang lain (opsional, biar rapi)
                faqItems.forEach(other => {
                    if (other !== item && other.classList.contains('open')) {
                        other.classList.remove('open');
                    }
                });
                item.classList.toggle('open');
            });
        });
    }

    // ========== Back Button (common.js sudah handle, tapi kita tambahin safety) ==========
    function initBackButton() {
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }
    }

    // ========== WebSocket Refresh Listener (untuk update statistik real-time) ==========
    function initWebSocketRefresh() {
        // Jika websocket sudah ada di global, kita bisa listen event 'NEW_EPISODE' untuk refresh statistik
        if (window.onRealtimeEvent) {
            window.onRealtimeEvent('NEW_EPISODE', () => {
                // Refresh statistik setelah 2 detik (biar database terupdate)
                setTimeout(() => {
                    fetchStats();
                }, 2000);
            });
            window.onRealtimeEvent('ANIME_UPDATED', () => {
                setTimeout(() => {
                    fetchStats();
                }, 2000);
            });
        }
    }

    // ========== Smooth scroll untuk anchor internal (jika ada) ==========
    function initSmoothAnchors() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // ========== Fallback jika API lambat: tampilkan placeholder ==========
    function setFallbackStats() {
        if (!statsData && !counterStarted) {
            // Setelah 3 detik jika belum ada data, tampilkan pesan
            setTimeout(() => {
                if (!statsData && statTotalAnimeEl && statTotalAnimeEl.textContent === '0') {
                    statTotalAnimeEl.textContent = '—';
                    statTotalEpisodesEl.textContent = '—';
                    statOngoingEl.textContent = '—';
                    statCompleteEl.textContent = '—';
                    statLastUpdatedEl.textContent = 'Gagal load';
                }
            }, 4000);
        }
    }

    // ========== Initialize All ==========
    document.addEventListener('DOMContentLoaded', () => {
        // Urutan inisialisasi
        initScrollProgress();
        initBackButton();
        initCarousel();
        initFaqAccordion();
        initScrollReveal();
        initCounterObserver();
        initWebSocketRefresh();
        initSmoothAnchors();
        setFallbackStats();

        // Jika stats section sudah terlihat sebelumnya (misal karena posisi scroll), panggil observer manual
        const statsSection = document.getElementById('statsSection');
        if (statsSection && window.IntersectionObserver) {
            const tempObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !counterStarted) {
                        counterStarted = true;
                        fetchStats();
                        tempObserver.disconnect();
                    }
                });
            }, { threshold: 0.1 });
            tempObserver.observe(statsSection);
        } else if (!counterStarted) {
            // fallback langsung fetch setelah 1 detik
            setTimeout(() => {
                if (!counterStarted) fetchStats();
            }, 1000);
        }
    });
})();