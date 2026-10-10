// Renders promo/<spot>/compose.html frame by frame. The page exposes
// window.render(t), a pure function of time, so frames can be split across
// several pages and rendered in parallel.
//
// Usage (inside the promo image, see build.sh): node render.js <spot> [times]
//   times: optional comma list, e.g. "1.5,5" → stills only
const { chromium } = require('playwright');
const fs = require('fs');

const [spot, stills] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(`/repo/promo/${spot}/spot.json`, 'utf8'));
const fps = cfg.fps || 30;
const OUT = `/out/${spot}`;
const [W, H] = cfg.size || [1920, 1080];

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    const open = async () => {
        const page = await browser.newPage({ viewport: { width: W, height: H } });
        page.on('pageerror', (e) => console.error('[page]', e.message));
        await page.goto(`file:///repo/promo/${spot}/compose.html`);
        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
        });
        return page;
    };
    const shoot = async (page, t, file) => {
        await page.evaluate((x) => window.render(x), t);
        await page.screenshot({ path: file });
    };

    if (stills) {
        fs.mkdirSync(`${OUT}/stills`, { recursive: true });
        const page = await open();
        for (const t of stills.split(',').map(Number)) await shoot(page, t, `${OUT}/stills/t${t.toFixed(2)}.png`);
    } else {
        fs.rmSync(`${OUT}/frames`, { recursive: true, force: true });
        fs.mkdirSync(`${OUT}/frames`, { recursive: true });
        const total = Math.round(cfg.duration * fps);
        const workers = Number(process.env.RENDER_WORKERS || 4);
        await Promise.all(
            Array.from({ length: workers }, async (_, w) => {
                const page = await open();
                for (let f = w; f < total; f += workers) {
                    await shoot(page, f / fps, `${OUT}/frames/f${String(f).padStart(4, '0')}.png`);
                }
            }),
        );
        console.log(`${total} frames → ${OUT}/frames`);
    }
    await browser.close();
})();