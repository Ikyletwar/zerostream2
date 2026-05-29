// ━━━ file: scripts/scraping/jsonrepair.js ━━━
/**
 * @file jsonrepair.js
 * @description Script utility untuk memperbaiki berkas JSON hasil scraping yang terpotong
 * atau rusak akibat masalah format string.
 * Jalankan: node scripts/scraping/jsonrepair.js
 */

import fs from 'fs';
import readline from 'readline';

const INPUT_FILE = 'anime_nimegami.json';
const OUTPUT_FILE = 'anime_nimegami_repaired.json';

/**
 * Memperbaiki sintaks berkas JSON.
 */
async function repairJson() {
    console.log('🔧 Memperbaiki file JSON...');

    const rl = readline.createInterface({
        input: fs.createReadStream(INPUT_FILE),
        crlfDelay: Infinity
    });

    let buffer = '';
    let lineCount = 0;

    for await (const line of rl) {
        buffer += line + '\n';
        lineCount++;
        if (lineCount % 10000 === 0) {
            console.log(`   Membaca baris ${lineCount}...`);
        }
    }

    console.log(`📄 Total baris: ${lineCount}`);

    let cleaned = buffer.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    cleaned = cleaned.replace(/,\s*\}/g, '}');
    cleaned = cleaned.replace(/,\s*\]/g, ']');

    try {
        const parsed = JSON.parse(cleaned);
        console.log('✅ JSON valid!');
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2));
        console.log(`📁 Disimpan ke ${OUTPUT_FILE}`);
        return;
    } catch (err) {
        console.error('❌ Gagal parse setelah pembersihan:', err.message);
    }

    console.log('🔍 Mencoba ekstraksi manual...');
    let depth = 0;
    let inString = false;
    let escape = false;
    let startObj = -1;
    let endObj = -1;

    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escape = true;
            continue;
        }
        if (ch === '"' && !escape) {
            inString = !inString;
        }
        if (!inString) {
            if (ch === '{') {
                if (depth === 0) startObj = i;
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    endObj = i;
                    break;
                }
            }
        }
    }

    if (startObj !== -1 && endObj !== -1) {
        const jsonText = cleaned.substring(startObj, endObj + 1);
        try {
            const parsed = JSON.parse(jsonText);
            console.log('✅ Berhasil ekstrak JSON manual!');
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2));
            console.log(`📁 Disimpan ke ${OUTPUT_FILE}`);
        } catch (err) {
            console.error('❌ Gagal parse hasil ekstraksi manual:', err.message);
            console.log('💡 Saran: cek baris terakhir file dengan editor teks (mungkin terpotong).');
        }
    } else {
        console.log('❌ Tidak menemukan objek JSON yang valid.');
    }
}

repairJson().catch(console.error);
