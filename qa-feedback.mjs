// Entra a un juego, empieza y responde la PRIMERA opción para medir el
// estado de feedback (aviso + explicación + botón) en la pantalla dada.
export default async function run(page, ui) {
  const u = new URL(page.url());
  const juego = u.searchParams.get('juego') || 'piramides';
  const width = Number(u.searchParams.get('w') || 375);
  const height = Number(u.searchParams.get('h') || 667);

  await page.setViewportSize({ width, height });
  await page.goto(`http://localhost:4200/razonamiento-logico/${juego}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const snap1 = await ui.snapshot();
  const empezar = snap1.match(/@(e\d+) button ".*Empezar.*"/)?.[1];
  if (empezar) { await ui.click(empezar); await page.waitForTimeout(1200); }

  // Clic en la primera opción de respuesta
  await page.locator('.qz-answer').first().click();
  await page.waitForTimeout(800);

  return await page.evaluate(() => {
    const m = (el) => el ? { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight } : null;
    const card = document.querySelector('.qz-question-card');
    const contenido = document.querySelector('.qz-contenido');
    const alerta = document.querySelector('.qz-question-card .alert');
    const desbordes = [];
    document.querySelectorAll('.quiz-page *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) {
        desbordes.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), right: Math.round(r.right) });
      }
    });
    const fueraAbajo = [];
    document.querySelectorAll('.qz-question-card .qz-answer, .qz-question-card .qz-boton-avanzar, .qz-question-card .qz-opciones').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 1) fueraAbajo.push({ cls: (el.className || '').toString().slice(0, 50), bottom: Math.round(r.bottom) });
    });
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      docSW: document.documentElement.scrollWidth,
      card: m(card), contenido: m(contenido), alerta: m(alerta),
      nDesbordes: desbordes.length, desbordesH: desbordes.slice(0, 5),
      elementosFueraAbajo: fueraAbajo,
      recorteCard: card ? card.scrollHeight - card.clientHeight : null,
      hasFeedback: !!alerta,
    };
  });
}
