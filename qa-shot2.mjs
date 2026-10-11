// Captura de juegos con pantalla propia (matemáticas interactivas, juegos mentales).
export default async function run(page, ui) {
  const u = new URL(page.url());
  const ruta = u.searchParams.get('ruta') || 'matematicas-interactivas';
  const nombre = u.searchParams.get('n') || 'shot';
  const width = Number(u.searchParams.get('w') || 375);
  const height = Number(u.searchParams.get('h') || 667);
  const click = u.searchParams.get('click') || '';

  await page.setViewportSize({ width, height });
  await page.goto(`http://localhost:4200/razonamiento-logico/${ruta}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (click) {
    const el = page.getByText(click, { exact: false }).first();
    if (await el.count()) { await el.click().catch(() => { }); await page.waitForTimeout(1500); }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/${nombre}-${width}x${height}.png` });

  const info = await page.evaluate(() => ({
    vw: window.innerWidth, vh: window.innerHeight,
    docSW: document.documentElement.scrollWidth,
    docSH: document.documentElement.scrollHeight,
    desbordes: [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1;
    }).slice(0, 5).map((el) => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), right: Math.round(el.getBoundingClientRect().right) })),
  }));
  return info;
}
