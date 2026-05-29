// ━━━ file: scripts/add-missing.js ━━━
/**
 * @file add-missing.js
 * @description Script CLI interaktif untuk menambahkan anime secara manual ke dalam
 * database SQLite ZeroStream berdasarkan URL nimegami.id.
 * Jalankan: node scripts/add-missing.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import readline from 'readline';
import { upsertAnime, saveEpisodes, getAnimeById } from '../backend/database.js';

const BASE_URL = 'https://nimegami.id';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Helper untuk meminta input dari user di terminal.
 * @param {string} query Pertanyaan prompt.
 * @returns {Promise<string>} Jawaban user.
 */
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Fetch HTML dari URL dengan timeout.
 * @param {string} url URL target.
 * @returns {Promise<string|null>} Data HTML string atau null jika gagal.
 */
async function fetchHtml(url) {
    try {
        const response = await axios.get(url, { timeout: 15000, headers: HEADERS });
        return response.data;
    } catch (error) {
        console.error(`❌ Gagal fetch ${url}: ${error.message}`);
        return null;
    }
}

/**
 * Ekstrak slug anime dari URL nimegami.
 * @param {string} url URL anime.
 * @returns {string|null} Slug anime.
 */
function extractSlug(url) {
    const match = url.match(/\.id\/([^\/?#]+)/);
    return match ? match[1] : null;
}

/**
 * Scrape data detail anime secara penuh dari halaman nimegami.id.
 * @param {string} animeUrl URL halaman anime.
 * @returns {Promise<Object|null>} Objek data anime siap database atau null.
 */
async function scrapeAnimeDetail(animeUrl) {
    console.log(`🔍 Mengambil data dari ${animeUrl} ...`);
    const html = await fetchHtml(animeUrl);
    if (!html) return null;

    const $ = cheerio.load(html);
    const slug = extractSlug(animeUrl);
    if (!slug) return null;

    const title = $('h1.entry-title').first().text().trim();
    const synopsis = $('#Sinopsis p').first().text().trim();

    let posterUrl = $('.thumbnail-a img').first().attr('src');
    if (posterUrl && !posterUrl.startsWith('http')) posterUrl = BASE_URL + posterUrl;

    let rating = null;
    const ratingText = $('.info2 tr:contains("Rating") td.ratingx').text();
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);

    let status = 'complete';
    if ($('.term_tag-a a:contains("On-going")').length > 0) status = 'ongoing';

    const genres = [];
    $('.info2 tr:contains("Kategori") td.info_a a, .genres a, .category a').each((i, el) => {
        const genre = $(el).text().trim();
        if (genre && !genres.includes(genre)) genres.push(genre);
    });

    let duration = null, studio = null, season = null, type = null, credit = null, alternativeTitle = null, seriesName = null;
    $('.info2 tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim().toLowerCase();
        let value = $(row).find('td:last-child').text().trim();
        if (label.includes('durasi')) duration = value;
        if (label.includes('studio')) studio = value;
        if (label.includes('musim') || label.includes('rilis')) season = value;
        if (label.includes('type')) type = value;
        if (label.includes('credit')) credit = value;
        if (label.includes('judul alternatif')) alternativeTitle = value;
        if (label.includes('series')) seriesName = value;
    });

    const episodes = [];
    $('.list_eps_stream li.select-eps, .episode-list li, .eps-list li').each((idx, el) => {
        const $el = $(el);
        const episodeNum = idx + 1;
        let streamUrls = { '360p': null, '480p': null, '720p': null, '1080p': null };

        const dataAttr = $el.attr('data');
        if (dataAttr) {
            try {
                const decoded = Buffer.from(dataAttr, 'base64').toString();
                const items = JSON.parse(decoded);
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        if (item.format && item.url && item.url[0]) {
                            streamUrls[item.format] = item.url[0];
                        }
                    });
                }
            } catch (e) {}
        }

        const iframeSrc = $el.find('iframe').attr('src');
        if (iframeSrc && !streamUrls['720p']) streamUrls['720p'] = iframeSrc;

        episodes.push({
            episode_number: episodeNum,
            title: `Episode ${episodeNum}`,
            stream_urls: streamUrls
        });
    });

    if (episodes.length === 0) {
        $('a[href*="/episode/"]').each((idx, el) => {
            const epUrl = $(el).attr('href');
            const epMatch = epUrl.match(/\/episode\/(\d+)/);
            const epNum = epMatch ? parseInt(epMatch[1]) : idx + 1;
            episodes.push({
                episode_number: epNum,
                title: $(el).text().trim() || `Episode ${epNum}`,
                stream_urls: { '720p': epUrl }
            });
        });
    }

    return {
        id: slug,
        url: animeUrl,
        title: title || slug,
        slug: slug,
        status: status,
        poster_url: posterUrl,
        poster_dimensions: { width: null, height: null },
        rating: rating,
        synopsis: synopsis,
        info: {
            alternative_title: alternativeTitle,
            duration: duration,
            studio: studio,
            genres: genres,
            season: season,
            type: type,
            total_episodes: episodes.length,
            subtitle: 'Indonesia',
            credit: credit,
            series_name: seriesName || title,
            is_complete: status === 'complete'
        },
        episodes: episodes,
        created_at: Date.now(),
        updated_at: Date.now()
    };
}

/**
 * Loop interaktif utama tambah anime.
 */
async function addAnime() {
    console.log(`
╔══════════════════════════════════════════════════╗
║        ZEROSTREAM - TAMBAH ANIME MANUAL         ║
╠══════════════════════════════════════════════════╣
║  Masukkan URL anime dari nimegami.id            ║
║  Contoh: https://nimegami.id/clannad-sub-indo-1/║
║  Kosongkan URL untuk selesai                    ║
╚══════════════════════════════════════════════════╝
    `);

    let addedCount = 0;
    let skipCount = 0;

    while (true) {
        const url = await askQuestion('\n🔗 Masukkan URL anime (atau langsung ENTER untuk selesai): ');
        if (!url.trim()) break;

        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'https://' + targetUrl;
        }

        const slug = extractSlug(targetUrl);
        if (!slug) {
            console.log('❌ URL tidak valid. Pastikan formatnya seperti: nimegami.id/judul-anime/');
            continue;
        }

        const existing = getAnimeById(slug);
        if (existing) {
            console.log(`⚠️ Anime "${existing.title}" sudah ada di database. Lewati.`);
            skipCount++;
            continue;
        }

        console.log(`\n📡 Mengambil data dari ${targetUrl}...`);
        const anime = await scrapeAnimeDetail(targetUrl);

        if (!anime) {
            console.log('❌ Gagal mengambil data. Periksa URL atau koneksi.');
            continue;
        }

        upsertAnime(anime);
        if (anime.episodes.length > 0) {
            saveEpisodes(anime.id, anime.episodes);
        }

        addedCount++;
        console.log(`\n✅ BERHASIL DITAMBAHKAN!`);
        console.log(`   Judul: ${anime.title}`);
        console.log(`   Episode: ${anime.episodes.length}`);
        console.log(`   Status: ${anime.status}`);
        console.log(`   Genre: ${anime.info.genres.join(', ')}`);
    }

    console.log(`
╔══════════════════════════════════════════════════╗
║                    RINGKASAN                     ║
╠══════════════════════════════════════════════════╣
║  ✅ Berhasil ditambahkan: ${addedCount} anime
║  ⏭️  Dilewati (sudah ada): ${skipCount} anime
╚══════════════════════════════════════════════════╝
    `);

    rl.close();
}

addAnime().catch(err => {
    console.error('Error:', err);
    rl.close();
    process.exit(1);
});
