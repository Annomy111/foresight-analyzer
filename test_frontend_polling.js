const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Track network requests
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        time: new Date().toISOString()
      });
      console.log(`[${request.method()}] ${request.url()}`);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/jobs/')) {
      const body = await response.text();
      console.log(`[RESPONSE] ${response.url()}: ${body.substring(0, 200)}`);
    }
  });
  
  console.log('🌐 Navigating to frontend...');
  await page.goto('https://foresight-analyzer-production.pages.dev', { waitUntil: 'networkidle0' });
  
  console.log('📝 Filling out form...');
  await page.waitForSelector('input[placeholder*="question" i]', { timeout: 10000 });
  
  // Fill form
  await page.type('input[placeholder*="question" i]', 'Test question for polling');
  await page.type('textarea[placeholder*="definition" i]', 'Test definition');
  await page.type('input[type="number"]', '1');
  await page.type('input[placeholder*="API" i]', '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');
  
  // Select only deepseek free model
  console.log('🎯 Selecting free model...');
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    const label = await page.evaluate(el => el.parentElement.textContent, checkbox);
    if (label.includes('deepseek-chat-v3.1:free')) {
      await checkbox.click();
      console.log('✅ Selected deepseek-chat-v3.1:free');
    }
  }
  
  console.log('🚀 Submitting forecast...');
  await page.click('button[type="submit"]');
  
  // Wait and watch for polling
  console.log('👀 Watching for polling requests...');
  await page.waitForTimeout(2000);
  
  // Check for progress updates in UI
  for (let i = 0; i < 15; i++) {
    const progressText = await page.evaluate(() => {
      const progressEl = document.querySelector('[class*="progress"], [class*="status"]');
      return progressEl ? progressEl.textContent : 'No progress element found';
    });
    console.log(`[${i}] UI Progress: ${progressText}`);
    await page.waitForTimeout(2000);
  }
  
  console.log('\n📊 Summary of API requests:');
  console.log(JSON.stringify(requests, null, 2));
  
  console.log('\n⏳ Keeping browser open for 10 more seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  console.log('✅ Test complete!');
})();
