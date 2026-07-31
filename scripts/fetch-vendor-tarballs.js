#!/usr/bin/env node
/**
 * Downloads private tarballs that pnpm/npm cannot fetch directly from our
 * Nexus due to upstream HTTP protocol incompatibility. Tarballs are saved
 * to ./.vendor/ and referenced via `file:` overrides in pnpm-workspace.yaml.
 *
 * Idempotent — skips downloads when the local file already exists.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const VENDOR_DIR = path.join(__dirname, '..', '.vendor');

const TARBALLS = [
    {
        name: '@tryghost/koenig-lexical',
        version: '1.7.20-poll.32',
        filename: 'koenig-lexical-1.7.20-poll.36.tgz',
        url: 'http://ratus-dnat-8ade08c660eaf714.elb.ap-east-1.amazonaws.com:31081/repository/npm-hosted1/@tryghost/koenig-lexical/-/koenig-lexical-1.7.20-poll.36.tgz'
    }
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https://') ? https : http;
        const file = fs.createWriteStream(dest);

        const req = client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return download(res.headers.location, dest).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        });

        req.on('error', (err) => {
            file.close();
            try { fs.unlinkSync(dest); } catch (_) {}
            reject(err);
        });
    });
}

async function main() {
    if (!fs.existsSync(VENDOR_DIR)) {
        fs.mkdirSync(VENDOR_DIR, { recursive: true });
    }

    for (const t of TARBALLS) {
        const dest = path.join(VENDOR_DIR, t.filename);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            console.log(`[vendor] skip (exists): ${t.filename}`);
            continue;
        }
        console.log(`[vendor] downloading ${t.name}@${t.version} ...`);
        try {
            await download(t.url, dest);
            const size = fs.statSync(dest).size;
            console.log(`[vendor] saved ${t.filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (err) {
            console.error(`[vendor] FAILED to download ${t.name}:`, err.message);
            process.exit(1);
        }
    }
}

main().catch((err) => {
    console.error('[vendor] unexpected error:', err);
    process.exit(1);
});
