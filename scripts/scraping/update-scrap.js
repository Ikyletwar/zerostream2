// ━━━ file: scripts/scraping/update-scrap.js ━━━
/**
 * @file update-scrap.js
 * @description Script updater untuk melengkapi data info anime yang kosong (seperti durasi, studio,
 * season, type, credit) pada file JSON yang sudah discrape sebelumnya.
 * Jalankan: node scripts/scraping/update-scrap.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const INPUT_FILE = 'anime_nimegami_repaired.json';
const OUTPUT_FILE = 'anime_nimegami_updated.json';
const CHECKPOINT_UPDATE = 'checkpoint_update.json';
const CONCURRENCY = 20;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
};

/**
 * Fetch data HTML dari URL.
 * @param {string} url URL target.
 * @returns {Promise<string|null>} Data HTML string atau null jika gagal.
 */
async function fetchHtml(url) {
    try {
        const res = await axios.get(url, { timeout: 10000, headers: HEADERS });
        return res.data;
    } catch (e) {
        console.error(`❌ Gagal fetch ${url}: ${e.message}`);
        return null;
    }
}

/**
 * Mengekstrak informasi info tambahan (durasi, studio, season, type, credit) dari halaman HTML.
 * @param {string} html Halaman HTML string.
 * @returns {Object} Objek info tambahan.
 */
function parseAdditionalInfo(html) {
    const $ = cheerio.load(html);

    let infoText = '';
    $('.info2, .single .info2, .single .info').each((i, el) => {
        infoText += $(el).text();
    });
    
    if (!infoText) infoText = $('body').text();

    function extract(label) {
        const regex = new RegExp(`${label}\\s*:\\s*\\|?\\s*([^\\n,]+)`, 'i');
        const match = infoText.match(regex);
        return match ? match[1].trim() : null;
    }

    const duration = extract('Durasi Per Episode');
    const studio = extract('Studio');
    const season = extract('Musim / Rilis');
    const type = extract('Type');
    const credit = extract('Credit');

    if (!duration) {
        const durRow = $('.info2 tr:contains("Durasi Per Episode")');
        if (durRow.length) {
            return {
                duration: durRow.find('td').last().text().trim(),
                studio: $('.info2 tr:contains("Studio")').find('td').last().text().trim(),
                season: $('.info2 tr:contains("Musim / Rilis")').find('td').last().text().trim(),
                type: $('.info2 tr:contains("Type")').find('td').last().text().trim(),
                credit: $('.info2 tr:contains("Credit")').find('td').last().text().trim()
            };
        }
    }

    return { duration, studio, season, type, credit };
}

/**
 * Loop utama pelengkap properti anime JSON.
 */
async function updateAnimeDetails() {
    console.log('📂 Membaca data existing...');
    const rawData = await fs.readFile(INPUT_FILE, 'utf-8');
    const data = JSON.parse(rawData);
    const animeList = data.anime_list;
    console.log(`📊 Total anime: ${animeList.length}`);

    let checkpoint = {};
    try {
        const checkpointRaw = await fs.readFile(CHECKPOINT_UPDATE, 'utf-8');
        checkpoint = JSON.parse(checkpointRaw);
    } catch (e) { }
    const processedUrls = new Set(checkpoint.processed_urls || []);

    const toUpdate = animeList.filter(anime => {
        return !processedUrls.has(anime.url) && (
            !anime.info.duration ||
            !anime.info.studio ||
            !anime.info.season ||
            !anime.info.type ||
            !anime.info.credit
        );
    });

    console.log(`🔄 Anime perlu update info: ${toUpdate.length}`);

    if (toUpdate.length === 0) {
        console.log('✅ Semua data sudah lengkap!');
        return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    const queue = [...toUpdate];
    const running = new Set();

    while (queue.length > 0 || running.size > 0) {
        while (running.size < CONCURRENCY && queue.length > 0) {
            const anime = queue.shift();
            const promise = (async () => {
                console.log(`🔄 Update: ${anime.title}`);
                const html = await fetchHtml(anime.url);
                if (html) {
                    const extra = parseAdditionalInfo(html);
                    if (extra.duration) anime.info.duration = extra.duration;
                    if (extra.studio) anime.info.studio = extra.studio;
                    if (extra.season) anime.info.season = extra.season;
                    if (extra.type) anime.info.type = extra.type;
                    if (extra.credit) anime.info.credit = extra.credit;
                    updatedCount++;
                    console.log(`   ✅ ${anime.title} -> Durasi: ${extra.duration || '-'}, Studio: ${extra.studio || '-'}`);
                } else {
                    failedCount++;
                    console.log(`   ❌ Gagal fetch ${anime.title}`);
                }
                processedUrls.add(anime.url);
                if (processedUrls.size % 10 === 0) {
                    await fs.writeFile(CHECKPOINT_UPDATE, JSON.stringify({ processed_urls: Array.from(processedUrls) }, null, 2));
                }
                running.delete(promise);
            })();
            running.add(promise);
        }
        if (running.size > 0) await Promise.race(running);
    }

    data.anime_list = animeList;
    data.metadata.last_updated = new Date().toISOString();
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`\n🎉 Update selesai! Berhasil: ${updatedCount}, Gagal: ${failedCount}`);
    console.log(`📁 Data disimpan di: ${OUTPUT_FILE}`);
}

updateAnimeDetails().catch(console.error);
