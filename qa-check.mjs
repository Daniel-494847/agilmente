export default async function run(page, ui) {
  const snap = await ui.snapshot();
  const start = snap.match(/@(e\d+) button "¡Empezar!"/)?.[1] || snap.match(/@(e\d+) button "Empezar"/)?.[1];
  if (!start) return { error: 'sin botón empezar', snap };
  await ui.click(start);
  await page.waitForTimeout(700);
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(await page.evaluate(() => {
      const cont = document.querySelector('.qz-contenido');
      const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
      return {
        figura: r('.qz-figura'), opciones: r('.qz-opciones'), alert: r('.qz-question-card .alert'),
        scrollInterno: cont ? cont.scrollHeight - cont.clientHeight : null,
        scrollPagina: document.documentElement.scrollHeight - innerHeight,
        enunciado: document.querySelector('.qz-enunciado')?.innerText?.slice(0, 40)
      };
    }));
    await page.locator('.qz-answer').first().click();
    await page.waitForTimeout(200);
    await page.locator('.qz-boton-avanzar').first().click();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: 'shot-check.png' });
  return out;
}
