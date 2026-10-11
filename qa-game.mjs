// Sonda: entra a un juego, empieza, y reporta el layout de la tarjeta del quiz
// (desbordes, recortes, tamaño de la figura/rejilla). Captura opcional.
export default async function run(page, ui) {
  const u = new URL(page.url());
  const juego = u.searchParams.get('juego') || 'seriaciones';
  const w = Number(u.searchParams.get('w') || 1280);
  const h = Number(u.searchParams.get('h') || 800);
  const shot = u.searchParams.get('shot') === '1';
  const responder = u.searchParams.get('responder') === '1';
  const nivel = u.searchParams.get('nivel');

  await page.setViewportSize({ width: w, height: h });
  await page.goto(`http://localhost:4200/razonamiento-logico/${juego}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  if (nivel) {
    const btn = page.locator('.qz-intro-card button', { hasText: new RegExp('^\\s*' + nivel, 'i') }).last();
    if (await btn.count()) { await btn.click().catch(() => { }); await page.waitForTimeout(600); }
  }

  const snap = await ui.snapshot();
  const empezar = snap.match(/@(e\d+) button "[^"]*Empezar[^"]*"/i)?.[1]
    || snap.match(/@(e\d+) button "[^"]*jugar[^"]*"/i)?.[1];
  if (empezar) { await ui.click(empezar); await page.waitForTimeout(1600); }

  if (responder) { await page.locator('.qz-answer').first().click().catch(() => { }); await page.waitForTimeout(800); }

  if (shot) await page.screenshot({ path: `shots/${juego}-${w}x${h}${responder ? '-fb' : ''}.png` });

  return await page.evaluate(() => {
    const m = (el) => el ? { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight } : null;
    const card = document.querySelector('.qz-question-card');
    const contenido = document.querySelector('.qz-contenido');
    const figura = document.querySelector('.qz-figura');
    const img = document.querySelector('.qz-figura img');
    const rejilla = document.querySelector('.qz-rejilla');
    const opciones = document.querySelector('.qz-opciones');
    const desbordes = [];
    document.querySelectorAll('.quiz-page *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) {
        desbordes.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), right: Math.round(r.right) });
      }
    });
    const fuera = [];
    document.querySelectorAll('.qz-question-card .qz-answer, .qz-question-card .qz-boton-avanzar, .qz-question-card .qz-opciones, .qz-question-card .alert').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 1 || r.top < -1) fuera.push({ cls: (el.className || '').toString().slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    });
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      docSW: document.documentElement.scrollWidth,
      card: m(card), contenido: m(contenido), figura: m(figura),
      imgNatural: img ? { nw: img.naturalWidth, nh: img.naturalHeight, cw: Math.round(img.clientWidth), ch: Math.round(img.clientHeight) } : null,
      rejilla: m(rejilla), opciones: m(opciones),
      nDesbordes: desbordes.length, desbordesH: desbordes.slice(0, 5),
      fuera: fuera.slice(0, 6),
      nOpciones: document.querySelectorAll('.qz-answer').length,
      enunciado: (document.querySelector('.qz-enunciado')?.textContent || '').trim().slice(0, 40),
    };
  });
}
