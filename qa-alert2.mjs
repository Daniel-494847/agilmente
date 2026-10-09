uego export default async function run(page) {
  await page.waitForSelector('.qz-intro-card', { timeout: 30000 });
  await page.getByRole('button', { name: /Empezar/ }).click();
  await page.waitForTimeout(1500);
  await page.locator('.qz-answer').first().click();
  await page.waitForTimeout(1200);

  return page.evaluate(() => {
    const alert = document.querySelector('.qz-question-card .alert');
    const r = alert.getBoundingClientRect();
    return {
      alertH: Math.round(r.height),
      alertW: Math.round(r.width),
      flexWrap: getComputedStyle(alert).flexWrap,
      gap: getComputedStyle(alert).gap,
      hijos: [...alert.children].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          txt: el.textContent.trim().slice(0, 25),
          top: Math.round(b.top - r.top),
          left: Math.round(b.left - r.left),
          w: Math.round(b.width),
          h: Math.round(b.height),
        };
      }),
    };
  });
}
