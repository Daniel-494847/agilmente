// QA: mide con cache desactivada (el CSS anterior seguia sirviendose).
export default async function run(page, ui) {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:4321/razonamiento-logico/cuadrados-magicos', { waitUntil: 'networkidle' });
  await page.waitForSelector('.qz-intro-card', { timeout: 30000 });

  const snap = await ui.snapshot();
  const nivel = snap.match(/@(e\d+) button "B.sico"/)?.[1];
  if (nivel) await ui.click(nivel);
  const empezar = (await ui.snapshot()).match(/@(e\d+) button ".*Empezar/)?.[1];
  if (empezar) await ui.click(empezar);
  await page.waitForTimeout(800);

  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const caja = (el) => (el ? el.getBoundingClientRect() : null);
    const r = (x) => (x ? { w: Math.round(x.width), h: Math.round(x.height) } : null);
    const hoja = Array.from(document.styleSheets).find((s) => (s.href || '').includes('styles'));
    return {
      // Regla realmente aplicada a la respuesta (no lo que creo haber escrito).
      respuestaPadding: q('.qz-answer') ? getComputedStyle(q('.qz-answer')).padding : null,
      respuestaAlto: r(caja(q('.qz-answer'))),
      letraCaja: r(caja(q('.qz-option-letter'))),
      celdaCaja: r(caja(q('.qz-rejilla-celda'))),
      opcionesAlto: r(caja(q('.qz-opciones'))),
      rejillaAlto: r(caja(q('.qz-rejilla'))),
      tarjetaAlto: r(caja(q('.qz-question-card'))),
      cssHref: hoja ? hoja.href.split('/').pop() : null,
      // Comprueba si la hoja servida ya trae la regla nueva.
      tieneReglaNueva: (() => {
        try {
          const reglas = Array.from(hoja.cssRules || []);
          return reglas.some((x) => x.cssText && x.cssText.includes('pad'));
        } catch (e) { return 'no accesible: ' + e; }
      })(),
    };
  });

  await page.screenshot({ path: 'qa-cuadrados-nuevo.png' });
  return m;
}
