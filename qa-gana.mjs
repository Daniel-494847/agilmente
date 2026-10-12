// QA: que regla de .qz-answer gana realmente, y por que.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:4321/razonamiento-logico/cuadrados-magicos', { waitUntil: 'networkidle' });
  await page.waitForSelector('.qz-intro-card', { timeout: 30000 });

  const snap = await ui.snapshot();
  const nivel = snap.match(/@(e\d+) button "B.sico"/)?.[1];
  if (nivel) await ui.click(nivel);
  const empezar = (await ui.snapshot()).match(/@(e\d+) button ".*Empezar/)?.[1];
  if (empezar) await ui.click(empezar);
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const el = document.querySelector('.qz-answer');
    const btn = document.querySelector('.qz-opciones .col');
    const cs = getComputedStyle(el);
    const csCol = getComputedStyle(btn);

    // Busca en todas las hojas TODAS las reglas que tocan .qz-answer.
    const encontradas = [];
    for (const hoja of Array.from(document.styleSheets)) {
      let reglas = [];
      try {
        reglas = Array.from(hoja.cssRules || []);
      } catch (e) {
        continue;
      }
      const recorrer = (lista, contexto) => {
        for (const r of lista) {
          if (r.media) {
            recorrer(Array.from(r.cssRules || []), (contexto ? contexto + ' + ' : '') + r.conditionText);
          } else if (r.selectorText && r.selectorText.includes('.qz-answer')) {
            encontradas.push({
              hoja: (hoja.href || 'inline').split('/').pop(),
              contexto: contexto || '(sin media)',
              coincide: el.matches(r.selectorText),
              css: r.cssText.slice(0, 120),
            });
          }
        }
      };
      recorrer(reglas, '');
    }
    return {
      paddingAplicado: cs.padding,
      altoBoton: Math.round(el.getBoundingClientRect().height),
      altoColumna: Math.round(btn.getBoundingClientRect().height),
      displayCol: csCol.display,
      altoAplicado: cs.height,
      reglas: encontradas,
    };
  });

  return info;
}
