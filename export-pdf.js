const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000';
const OUTPUT = 'kwanda-deck.pdf';
const SLIDE_WIDTH = 1440;
const SLIDE_HEIGHT = 810;

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 2 });

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));(500);

  // Get total slide count
  const total = await page.evaluate(() =>
    document.querySelectorAll('.slide').length
  );

  if (!total) {
    console.error('Could not find slides. Make sure the server is running.');
    await browser.close();
    process.exit(1);
  }

  console.log(`Found ${total} slides. Capturing...`);

  const screenshots = [];
  const tmpDir = path.join(__dirname, '.pdf-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  for (let i = 0; i < total; i++) {
    const file = path.join(tmpDir, `slide-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    screenshots.push(file);
    console.log(`  Captured slide ${i + 1} / ${total}`);

    if (i < total - 1) {
      await page.keyboard.press('ArrowRight');
      await new Promise(r => setTimeout(r, 700)); // wait for 550ms transition + buffer
    }
  }

  console.log('Generating PDF...');

  // Build PDF using puppeteer's built-in PDF generation from a local HTML page
  const imgTags = screenshots.map(f =>
    `<img src="file://${f}">`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0; size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px; }
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  html, body { margin:0; padding:0; background:#000; width:${SLIDE_WIDTH}px; }
  img { width:${SLIDE_WIDTH}px; height:${SLIDE_HEIGHT}px; display:block; page-break-after:always; page-break-inside:avoid; }
</style>
</head>
<body>${imgTags}</body>
</html>`;

  const htmlFile = path.join(tmpDir, 'slides.html');
  fs.writeFileSync(htmlFile, html);

  const pdfPage = await browser.newPage();
  await pdfPage.goto(`file://${htmlFile}`, { waitUntil: 'networkidle0' });
  await pdfPage.pdf({
    path: OUTPUT,
    width: `${SLIDE_WIDTH}px`,
    height: `${SLIDE_HEIGHT}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

  // Clean up tmp files
  fs.rmSync(tmpDir, { recursive: true });

  console.log(`\n✅ PDF saved to: ${OUTPUT}`);
})();
