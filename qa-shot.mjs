
// Captura aislada: carga limpia, entra al juego y fotografia.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:4321/razonamiento-logico/cuadrados-magicos', { waitUntil: 'load' });
  await page.waitForSelector('.qz-intro-card', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const snap = await ui.snapshot();
  const nivel = snap.match(/@(e\d+) button "B.sico"/)?.[1];
  if (nivel) await ui.click(nivel);
  await page.waitForTimeout(300);
  const empezar = (await ui.snapshot()).match(/@(e\d+) button ".*Empezar/)?.[1];
  if (empezar) await ui.click(empezar);
  await page.waitForTimeout(1200);

  // Confirma que la hoja nueva esta activa ANTES de fotografiar.
  const ok = await page.evaluate(() => {
    const el = document.querySelector('.qz-answer');
    return el ? getComputedStyle(el).padding : null;
  });

  await page.screenshot({ path: 'captura-final.png' });
  return { paddingActivo: ok, ruta: 'captura-final.png' };
}
