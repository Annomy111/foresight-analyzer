const puppeteer = require('puppeteer');

(async () => {
  const url = process.env.DEPLOY_URL || 'https://foresight-analyzer.pages.dev';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    console.log(`Navigating to ${url} ...`);
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    if (!response) {
      throw new Error('No response received from page');
    }

    const status = response.status();
    console.log(`HTTP status: ${status}`);

    if (status >= 400) {
      throw new Error(`Non-success status code: ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('Body preview:', bodyText.replace(/\s+/g, ' ').trim());

    console.log('Deployment appears reachable.');
    process.exit(0);
  } catch (err) {
    console.error('Deployment check failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
