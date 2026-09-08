#!/usr/bin/env node
/**
 * portal-fingerprint.mjs
 *
 * 把构建好的 Portal bundle 以“内容哈希文件名”拷进主题,并让 Ghost 的 portal.url
 * 指向这个文件名。换文件名 = 对浏览器 / CDN / 代理都是必然 MISS,比 ?v= 破缓存
 * 可靠得多(很多 CDN 会忽略 query string)。
 *
 * - 文件名 = portal.<内容hash>.min.js(内容变才变名,自动)。
 * - defaults.json 的 portal.url 直接写死成这个文件名(不用 {version} 占位符)。
 * - 不改 portal.version 字段(它对这种写死 url 无作用,保持原样)。
 *
 * 用法(Ghost 仓库根目录):
 *   node scripts/portal-fingerprint.mjs          # 文件名 = 内容 hash(推荐)
 *   node scripts/portal-fingerprint.mjs 2.80      # 或用你指定的标签当文件名
 *   node scripts/portal-fingerprint.mjs --dry      # 只预览,不改任何文件
 *
 * 前提:先构建 Portal(产物在 apps/portal/umd/portal.min.js)。
 * 运行后:部署主题(带新的 assets/umd/portal.<tag>.min.js) + 重新部署并重启
 * Ghost core;有 CDN 就 purge 一次。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ghostRoot = path.resolve(__dirname, '..');

// ---- 路径(主题若不在 Ghost 的同级目录,改 THEME_UMD 即可)----
const BUILT_JS  = path.join(ghostRoot, 'apps/portal/umd/portal.min.js');
const BUILT_MAP = BUILT_JS + '.map';
const THEME_UMD = path.resolve(ghostRoot, '../ratus-ghost-theme/assets/umd');
const DEFAULTS  = path.join(ghostRoot, 'ghost/core/core/shared/config/defaults.json');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const argTag = args.find(a => !a.startsWith('--'));

const die = m => { console.error('✗ ' + m); process.exit(1); };
const log = m => console.log((dry ? '[dry] ' : '      ') + m);

if (!fs.existsSync(BUILT_JS)) die(`找不到 Portal 构建产物:${BUILT_JS}\n  先构建 Portal 再运行。`);
if (!fs.existsSync(THEME_UMD)) die(`找不到主题 umd 目录:${THEME_UMD}\n  改脚本顶部的 THEME_UMD。`);
if (!fs.existsSync(DEFAULTS)) die(`找不到 defaults.json:${DEFAULTS}`);

const buf = fs.readFileSync(BUILT_JS);
const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const tag = (argTag || hash).replace(/[^A-Za-z0-9._-]/g, '-');

const jsName  = `portal.${tag}.min.js`;
const mapName = `portal.${tag}.min.js.map`;

console.log(`\nPortal fingerprint  file=${jsName}${dry ? '   (DRY RUN — 不写盘)' : ''}`);

// 1) 清理主题里旧的 portal bundle,保持目录整洁
for (const f of fs.readdirSync(THEME_UMD)) {
    if (f.startsWith('portal.') && (f.endsWith('.min.js') || f.endsWith('.min.js.map'))) {
        if (!dry) fs.rmSync(path.join(THEME_UMD, f));
        log('删除旧文件  ' + f);
    }
}

// 2) 拷贝新 bundle(顺带把 sourceMappingURL 改成指纹 map 名)
let js = buf.toString('utf8');
if (fs.existsSync(BUILT_MAP)) {
    js = js.replace(/sourceMappingURL=portal[^\s]*\.min\.js\.map/g, 'sourceMappingURL=' + mapName);
    if (!dry) fs.copyFileSync(BUILT_MAP, path.join(THEME_UMD, mapName));
    log('写入        ' + mapName);
}
if (!dry) fs.writeFileSync(path.join(THEME_UMD, jsName), js);
log(`写入        ${jsName}  (${(buf.length / 1048576).toFixed(2)} MB)`);

// 3) 改 defaults.json:portal.url 写死成指纹文件名(定点替换,保留原格式)。不动 version。
let cfg = fs.readFileSync(DEFAULTS, 'utf8');
const urlRe = /("url":\s*")\/assets\/umd\/portal[^"]*\.min\.js[^"]*(")/;
if (!urlRe.test(cfg)) die('在 defaults.json 里没找到 portal.url,检查文件。');
cfg = cfg.replace(urlRe, `$1/assets/umd/${jsName}$2`);
if (!dry) fs.writeFileSync(DEFAULTS, cfg);
log('更新        defaults.json  portal.url -> /assets/umd/' + jsName);

console.log(`\n✓ ${dry ? '预览完成(未改动任何文件)' : '完成'}。file=${jsName}`);
if (!dry) console.log('  下一步:部署主题 + 重新部署/重启 Ghost core;有 CDN 就 purge 一次。');
