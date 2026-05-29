// ━━━ file: scripts/scraping/scrap.js ━━━
/**
 * @file scrap.js
 * @description Script scraper utama untuk mengambil seluruh daftar link anime dan detail
 * informasi anime dari nimegami.id secara batch menggunakan concurrency tinggi.
 * Jalankan: node scripts/scraping/scrap.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://nimegami.id';
const CONCURRENCY_PAGES = 20;    // Ambil 20 halaman sekaligus
const CONCURRENCY_DETAIL = 15;   // Scrape detail 15 anime sekaligus
const MAX_RETRIES = 2;
const OUTPUT_FILE = 'anime_nimegami.json';
const CHECKPOINT_FILE = 'checkpoint.json';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
};

/**
 * Helper fetch dengan mekanisme retry jika gagal.
 * @param {string} url URL target.
 * @returns {Promise<string>} Data HTML string.
 */
async function fastFetch(url) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const res = await axios.get(url, { timeout: 10000, headers: HEADERS });
            return res.data;
        } catch (e) {
            if (i === MAX_RETRIES - 1) throw e;
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

/**
 * Mengambil semua URL anime yang ada dari halaman index nimegami dengan concurrency.
 * @returns {Promise<string[]>} Daftar URL link anime unik.
 */
async function getAllAnimeLinksFast() {
    console.log('🔍 Mendeteksi total halaman...');
    const firstPage = await fastFetch(BASE_URL);
    let $ = cheerio.load(firstPage);

    let lastPage = 1;
    $('.pagination a.page-numbers').each((i, el) => {
        const pageNum = parseInt($(el).text());
        if (!isNaN(pageNum) && pageNum > lastPage) lastPage = pageNum;
    });
    
    const lastLink = $('.pagination a:last-child').attr('href');
    if (lastLink) {
        const match = lastLink.match(/\/page\/(\d+)/);
        if (match) lastPage = parseInt(match[1]);
    }
    console.log(`📄 Total halaman: ${lastPage}`);

    const pageUrls = [];
    for (let i = 1; i <= lastPage; i++) {
        pageUrls.push(i === 1 ? BASE_URL : `${BASE_URL}/page/${i}/`);
    }

    console.log(`🚀 Mengambil ${pageUrls.length} halaman dengan concurrency ${CONCURRENCY_PAGES}...`);

    const allLinks = new Set();
    for (let i = 0; i < pageUrls.length; i += CONCURRENCY_PAGES) {
        const batch = pageUrls.slice(i, i + CONCURRENCY_PAGES);
        const results = await Promise.all(batch.map(async (url, idx) => {
            try {
                const html = await fastFetch(url);
                const $page = cheerio.load(html);
                const links = [];
                $page('article .thumb a, .post-article article .thumb a').each((_, el) => {
                    const href = $page(el).attr('href');
                    if (href && href.startsWith(BASE_URL)) links.push(href);
                });
                console.log(`  ✅ Halaman ${i + idx + 1}: ${links.length} link`);
                return links;
            } catch (e) {
                console.log(`  ❌ Halaman ${i + idx + 1} gagal`);
                return [];
            }
        }));
        for (const links of results) {
            links.forEach(link => allLinks.add(link));
        }
        console.log(`📊 Progress: ${allLinks.size} link unik terkumpul...`);
    }

    console.log(`✅ Total link anime: ${allLinks.size}`);
    return Array.from(allLinks);
}

/**
 * Scrape detail halaman anime secara mandiri.
 * @param {string} animeUrl URL detail anime.
 * @param {string} slug Slug anime.
 * @returns {Promise<Object|null>} Objek anime atau null jika gagal.
 */
async function scrapeDetailFast(animeUrl, slug) {
    try {
        const html = await fastFetch(animeUrl);
        const $ = cheerio.load(html);

        const title = $('h1.title').first().text().trim();
        const synopsis = $('#Sinopsis p').first().text().trim();

        const posterImg = $('.thumbnail-a img').first();
        const posterUrl = posterImg.attr('src');
        let width = posterImg.attr('width') ? parseInt(posterImg.attr('width')) : null;
        let height = posterImg.attr('height') ? parseInt(posterImg.attr('height')) : null;

        let rating = null;
        const ratingText = $('.info2 tr:contains("Rating") td.ratingx').text();
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) rating = parseFloat(ratingMatch[1]);

        const genres = [];
        $('.info2 tr:contains("Kategori") td.info_a a').each((_, el) => {
            genres.push($(el).text().trim());
        });

        let status = 'complete';
        if ($('.term_tag-a a:contains("On-going")').length > 0) status = 'ongoing';

        let seriesName = title;
        const seriesRow = $('.info2 tr:contains("Series")');
        if (seriesRow.length) seriesName = seriesRow.find('td').last().text().trim();

        const episodes = [];
        $('.list_eps_stream li.select-eps').each((idx, el) => {
            const $el = $(el);
            const dataAttr = $el.attr('data');
            const episodeNum = idx + 1;
            let streamUrls = { '360p': null, '480p': null, '720p': null, '1080p': null };

            if (dataAttr) {
                try {
                    const decoded = Buffer.from(dataAttr, 'base64').toString();
                    const items = JSON.parse(decoded);
                    items.forEach(item => {
                        if (item.format && item.url && item.url[0]) {
                            streamUrls[item.format] = item.url[0];
                        }
                    });
                } catch (e) { }
            }
            episodes.push({
                episode_number: episodeNum,
                title: `Episode ${episodeNum}`,
                stream_urls: streamUrls,
                mirror_servers: { '360p': [], '480p': [], '720p': [], '1080p': [] }
            });
        });

        return {
            id: slug,
            url: animeUrl,
            title,
            slug,
            status,
            poster_url: posterUrl,
            poster_dimensions: { width, height },
            rating,
            synopsis,
            info: {
                alternative_title: null,
                duration: null,
                studio: null,
                genres,
                season: null,
                type: null,
                total_episodes: episodes.length,
                subtitle: 'Indonesia',
                credit: null,
                series_name: seriesName,
                is_complete: status === 'complete'
            },
            episodes
        };
    } catch (e) {
        console.error(`❌ Gagal detail ${slug}: ${e.message}`);
        return null;
    }
}

/**
 * Memuat status checkpoint scraping jika ada.
 * @returns {Promise<Object>} Status checkpoint.
 */
async function loadCheckpoint() {
    try {
        const data = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        return JSON.parse(data);
    } catch { 
        return { scraped_links: [], anime_list: [] }; 
    }
}

/**
 * Menyimpan status checkpoint scraping saat ini.
 * @param {Set<string>} scrapedLinks Set link yang telah diproses.
 * @param {Object[]} animeList Daftar objek anime yang telah discrape.
 */
async function saveCheckpoint(scrapedLinks, animeList) {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify({
        scraped_links: Array.from(scrapedLinks),
        anime_list: animeList.map(a => ({ id: a.id, title: a.title }))
    }, null, 2));
}

/**
 * Loop utama proses scraping link dan detail anime.
 */
async function main() {
    console.log('🚀 MEMULAI SCRAPING SUPER CEPAT...\n');

    const allLinks = await getAllAnimeLinksFast();

    const checkpoint = await loadCheckpoint();
    const scrapedLinks = new Set(checkpoint.scraped_links || []);
    let animeData = checkpoint.anime_list || [];
    const existingMap = new Map(animeData.map(a => [a.id, a]));

    const pendingLinks = allLinks.filter(link => !scrapedLinks.has(link));
    console.log(`\n📊 Total: ${allLinks.length}, Sudah: ${scrapedLinks.size}, Perlu: ${pendingLinks.length}\n`);

    if (pendingLinks.length === 0) {
        console.log('✅ Semua sudah discrape!');
        return;
    }

    let processed = 0;
    let failed = 0;
    const queue = [...pendingLinks];
    const running = new Set();

    while (queue.length > 0 || running.size > 0) {
        while (running.size < CONCURRENCY_DETAIL && queue.length > 0) {
            const url = queue.shift();
            const slug = url.match(/\/([^\/?#]+)\/?$/)[1];
            const promise = (async () => {
                const result = await scrapeDetailFast(url, slug);
                if (result) {
                    existingMap.set(result.id, result);
                    processed++;
                    console.log(`✅ [${processed}/${pendingLinks.length}] ${result.title}`);
                } else {
                    failed++;
                    console.log(`❌ Gagal: ${slug}`);
                }
                scrapedLinks.add(url);
                
                const updatedList = Array.from(existingMap.values());
                await saveCheckpoint(scrapedLinks, updatedList);
                const output = {
                    metadata: { scraped_at: new Date().toISOString(), total_anime: updatedList.length },
                    anime_list: updatedList
                };
                await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
                running.delete(promise);
            })();
            running.add(promise);
        }
        if (running.size > 0) await Promise.race(running);
    }

    console.log(`\n🎉 Selesai! Berhasil: ${processed}, Gagal: ${failed}`);
    console.log(`📁 Data: ${OUTPUT_FILE}`);
}

main().catch(console.error);
