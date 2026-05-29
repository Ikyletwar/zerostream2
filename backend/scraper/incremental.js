// backend/scraper/incremental.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
    upsertAnime, 
    getAnimeById,
    addFeedEvent,
    saveEpisode
} from '../database.js';
import { emitNewEpisode, broadcast } from '../websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE_PATH = path.join(__dirname, '../data/ongoing_schedule_cache.json');

const BASE_URL = 'https://nimegami.id';
const ONGOING_URL = 'https://nimegami.id/anime-terbaru-sub-indo/';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
};
const REQUEST_DELAY_MS = 500;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchHtml(url, retries = 2) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, { timeout: 15000, headers: HEADERS });
            return response.data;
        } catch (error) {
            if (i === retries - 1) return null;
            await sleep(1000 * (i + 1));
        }
    }
    return null;
}

function extractSlug(url) {
    if (!url) return null;
    const match = url.match(/\/([^\/?#]+)\/?$/);
    return match ? match[1] : null;
}

// ========== 1. SCRAPE ONGOING SCHEDULE ==========
async function scrapeOngoingSchedule() {
    console.log('🔍 Scraping ongoing schedule...');
    const html = await fetchHtml(ONGOING_URL);
    if (!html) throw new Error('Failed to fetch ongoing schedule HTML');
    
    const $ = cheerio.load(html);
    const schedule = [];
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    
    for (const day of days) {
        $(`#${day} article`).each((i, el) => {
            const $el = $(el);
            const animeLink = $el.find('.thumb a').first().attr('href');
            if (!animeLink) return;
            const slug = extractSlug(animeLink);
            if (!slug) return;
            
            const title = $el.find('h3 a').first().text().trim();
            schedule.push({
                source: 'schedule',
                day, title, slug, animeUrl: animeLink
            });
        });
    }
    console.log(`📊 Schedule: ${schedule.length} entries`);
    return schedule;
}

// ========== 2. SCRAPE HOMEPAGE (untuk anime yang tidak terjadwal) ==========
async function scrapeHomepage() {
    console.log('🔍 Scraping homepage for recent anime...');
    const html = await fetchHtml(BASE_URL);
    if (!html) return [];
    const $ = cheerio.load(html);
    const recent = [];
    
    $('.post-article article, article.stiky_post').each((i, el) => {
        const $el = $(el);
        const animeLink = $el.find('.thumb a').first().attr('href');
        if (!animeLink) return;
        const slug = extractSlug(animeLink);
        if (!slug) return;
        
        const title = $el.find('.info h2 a').first().text().trim();
        recent.push({
            source: 'homepage',
            title, slug, animeUrl: animeLink
        });
    });
    
    console.log(`📊 Homepage: ${recent.length} entries`);
    return recent;
}

// ========== 3. FETCH DETAIL ANIME (untuk anime baru) ==========
async function fetchAnimeDetail(animeUrl, slug) {
    const html = await fetchHtml(animeUrl);
    if (!html) return null;
    const $ = cheerio.load(html);
    const title = $('h1.title, h1.entry-title, .single-title').first().text().trim();
    const synopsis = $('#Sinopsis p, .synopsis p, .description p').first().text().trim();
    let posterUrl = $('.thumbnail-a img, .poster img, .anime-poster img').first().attr('src');
    if (posterUrl && !posterUrl.startsWith('http')) posterUrl = BASE_URL + posterUrl;
    
    let rating = null;
    const ratingText = $('.rating, .info2 tr:contains("Rating") td, .score').text();
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    
    let status = 'complete';
    if ($('.term_tag-a a:contains("On-going"), .status-ongoing, [class*="ongoing"]').length > 0) status = 'ongoing';
    
    const genres = [];
    $('.info2 tr:contains("Kategori") td a, .genres a, .genre-list a').each((i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
    });
    
    let studio = null, type = null;
    $('.info2 tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim().toLowerCase();
        const value = $(row).find('td:last-child').text().trim();
        if (label.includes('studio')) studio = value;
        if (label.includes('type') || label.includes('tipe')) type = value;
    });
    
    // Episode list lengkap dari halaman detail
    const episodes = [];
    $('.list_eps_stream li').each((idx, el) => {
        const epNum = idx + 1;
        let streamUrls = { '360p': null, '480p': null, '720p': null, '1080p': null };
        const dataAttr = $(el).attr('data');
        if (dataAttr) {
            try {
                const decoded = Buffer.from(dataAttr, 'base64').toString();
                const items = JSON.parse(decoded);
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.format && item.url && item.url[0]) streamUrls[item.format] = item.url[0];
                    });
                }
            } catch(e) {}
        }
        const iframeSrc = $(el).find('iframe').attr('src');
        if (iframeSrc && !streamUrls['720p']) streamUrls['720p'] = iframeSrc;
        episodes.push({
            episode_number: epNum,
            title: `Episode ${epNum}`,
            stream_urls: streamUrls
        });
    });
    
    // Fallback jika tidak ada .list_eps_stream li
    if (episodes.length === 0) {
        $('a[href*="/episode/"]').each((idx, el) => {
            const epUrl = $(el).attr('href');
            const epNum = epUrl.match(/\/episode\/(\d+)/) ? parseInt(epUrl.match(/\/episode\/(\d+)/)[1]) : idx+1;
            episodes.push({
                episode_number: epNum,
                title: $(el).text().trim() || `Episode ${epNum}`,
                stream_urls: { '720p': epUrl }
            });
        });
    }
    
    return {
        id: slug, url: animeUrl, title: title || slug, slug,
        status, poster_url: posterUrl, rating, synopsis,
        info: {
            studio, type, genres,
            total_episodes: episodes.length,
            subtitle: 'Indonesia',
            series_name: title,
            is_complete: status === 'complete'
        },
        episodes,
        created_at: Date.now(),
        updated_at: Date.now()
    };
}

// ========== 4. FETCH EPISODE BARU (hanya episode dengan nomor > lastKnown) ==========
async function fetchNewEpisodesFromAnimePage(animeUrl, lastKnownEpisode) {
    const html = await fetchHtml(animeUrl);
    if (!html) return [];
    const $ = cheerio.load(html);
    const newEpisodes = [];
    $('.list_eps_stream li').each((idx, el) => {
        const epNum = idx + 1;
        if (epNum <= lastKnownEpisode) return;
        let streamUrls = { '360p': null, '480p': null, '720p': null, '1080p': null };
        const dataAttr = $(el).attr('data');
        if (dataAttr) {
            try {
                const decoded = Buffer.from(dataAttr, 'base64').toString();
                const items = JSON.parse(decoded);
                items.forEach(item => {
                    if (item.format && item.url && item.url[0]) streamUrls[item.format] = item.url[0];
                });
            } catch(e) {}
        }
        const iframeSrc = $(el).find('iframe').attr('src');
        if (iframeSrc && !streamUrls['720p']) streamUrls['720p'] = iframeSrc;
        newEpisodes.push({
            episode_number: epNum,
            title: `Episode ${epNum}`,
            stream_urls: streamUrls
        });
    });
    // Fallback jika tidak ada .list_eps_stream li
    if (newEpisodes.length === 0) {
        $('a[href*="/episode/"]').each((idx, el) => {
            const epUrl = $(el).attr('href');
            const epNum = epUrl.match(/\/episode\/(\d+)/) ? parseInt(epUrl.match(/\/episode\/(\d+)/)[1]) : idx+1;
            if (epNum > lastKnownEpisode) {
                newEpisodes.push({
                    episode_number: epNum,
                    title: $(el).text().trim() || `Episode ${epNum}`,
                    stream_urls: { '720p': epUrl }
                });
            }
        });
        // Urutkan berdasarkan nomor episode
        newEpisodes.sort((a,b) => a.episode_number - b.episode_number);
    }
    return newEpisodes;
}

// ========== 5. MAIN INCREMENTAL SCRAPE ==========
export async function incrementalScrape() {
    const startTime = Date.now();
    console.log('\n🔄 ========== INCREMENTAL SCRAPE START ==========');
    const summary = { newAnime: [], newEpisodes: [], updatedAnime: [], errors: [] };
    
    // Kumpulkan anime dari schedule dan homepage (tanpa angka episode)
    let allAnimeSources = [];
    try {
        const schedule = await scrapeOngoingSchedule();
        allAnimeSources.push(...schedule);
        // Simpan cache schedule
        const cacheDir = path.dirname(CACHE_FILE_PATH);
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({ timestamp: Date.now(), data: schedule }, null, 2));
    } catch (error) {
        console.error('❌ Schedule scrape failed, using cache:', error.message);
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const cached = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
            allAnimeSources.push(...cached.data);
        }
    }
    
    try {
        const homepage = await scrapeHomepage();
        allAnimeSources.push(...homepage);
    } catch (error) {
        console.error('❌ Homepage scrape failed:', error.message);
    }
    
    // Deduplikasi berdasarkan slug
    const uniqueMap = new Map();
    for (const item of allAnimeSources) {
        if (!uniqueMap.has(item.slug)) {
            uniqueMap.set(item.slug, item);
        }
    }
    const uniqueAnimeList = Array.from(uniqueMap.values());
    console.log(`📊 Total unique anime to process: ${uniqueAnimeList.length}`);
    
    // Proses setiap anime: untuk existing langsung cek detail page
    for (const item of uniqueAnimeList) {
        await sleep(REQUEST_DELAY_MS);
        try {
            const existing = getAnimeById(item.slug);
            if (!existing) {
                // Anime baru: fetch detail lengkap
                console.log(`🆕 New anime: ${item.title}`);
                const newAnime = await fetchAnimeDetail(item.animeUrl, item.slug);
                if (newAnime) {
                    upsertAnime(newAnime);
                    for (const ep of newAnime.episodes) {
                        saveEpisode(newAnime.id, ep);
                    }
                    summary.newAnime.push({ id: newAnime.id, title: newAnime.title });
                    addFeedEvent('NEW_ANIME', newAnime.id, null, `${newAnime.title} added to catalog`);
                    broadcast({ type: 'REFRESH_CAROUSEL', timestamp: Date.now() });
                    console.log(`   ✅ Added new anime: ${newAnime.title} with ${newAnime.episodes.length} episodes`);
                } else {
                    summary.errors.push({ slug: item.slug, reason: 'fetch detail failed' });
                }
            } 
            else {
                // Anime existing: cek langsung halaman detail untuk episode baru
                const currentMaxEp = existing.episodes.length;
                const newEpisodes = await fetchNewEpisodesFromAnimePage(item.animeUrl, currentMaxEp);
                if (newEpisodes.length > 0) {
                    console.log(`🆕 New episode(s) for ${existing.title}: found ${newEpisodes.length} new (current max ${currentMaxEp} -> ${newEpisodes[newEpisodes.length-1].episode_number})`);
                    for (const ep of newEpisodes) {
                        saveEpisode(existing.id, ep);
                        summary.newEpisodes.push({
                            animeId: existing.id,
                            animeTitle: existing.title,
                            episodeNumber: ep.episode_number,
                            episodeTitle: ep.title
                        });
                        emitNewEpisode(existing.id, existing.title, ep.episode_number, ep.title);
                    }
                    summary.updatedAnime.push({ id: existing.id, title: existing.title });
                    broadcast({ type: 'REFRESH_CAROUSEL', timestamp: Date.now() });
                } else {
                    console.log(`✓ No new episode for ${existing.title} (current max: ${currentMaxEp})`);
                }
            }
        } catch (err) {
            console.error(`❌ Error processing ${item.slug}:`, err.message);
            summary.errors.push({ slug: item.slug, error: err.message });
        }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scrape completed in ${duration}s`);
    console.log(`   New anime: ${summary.newAnime.length}`);
    console.log(`   New episodes: ${summary.newEpisodes.length}`);
    console.log(`   Errors: ${summary.errors.length}`);
    console.log('🔄 ========== INCREMENTAL SCRAPE END ==========\n');
    
    return summary;
}