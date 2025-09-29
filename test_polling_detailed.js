const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Detailed polling test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Track all API requests with timestamps
  const apiRequests = [];
  
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      const entry = {
        time: new Date().toISOString(),
        method: request.method(),
        url: request.url()
      };
      apiRequests.push(entry);
      console.log(`📤 [${entry.time}] ${entry.method} ${entry.url.split('/api/')[1]}`);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/jobs/')) {
      const status = response.status();
      const body = await response.text().catch(() => '{}');
      try {
        const data = JSON.parse(body);
        console.log(`📥 [RESPONSE] Status: ${data.status}, Progress: ${data.progress}, Message: ${data.message}`);
      } catch (e) {
        console.log(`📥 [RESPONSE] ${status} - Could not parse`);
      }
    }
  });
  
  // Capture React Query errors
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Query') || text.includes('error') || text.includes('failed')) {
      console.log(`[BROWSER]: ${text}`);
    }
  });
  
  console.log('📱 Loading page...\n');
  await page.goto('https://270d6e7b.foresight-analyzer.pages.dev/', { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('🔑 Filling form...');
  await page.type('input[placeholder*="sk-or" i]', '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');
  
  const iterationsInput = await page.$('input[type="number"]');
  if (iterationsInput) {
    await iterationsInput.click({ clickCount: 3 });
    await iterationsInput.type('1');
  }
  
  console.log('🚀 Submitting...\n');
  const submitButton = await page.$('button[type="submit"]');
  await submitButton.click();
  
  console.log('⏳ Monitoring API requests for 30 seconds...\n');
  console.log('Expected: GET /api/jobs/... should repeat every 2 seconds\n');
  
  // Monitor for 30 seconds
  const startTime = Date.now();
  let lastCheck = 0;
  
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed > lastCheck) {
      lastCheck = elapsed;
      
      // Count job status requests in the last 5 seconds
      const recentRequests = apiRequests.filter(req => {
        const reqTime = new Date(req.time).getTime();
        return req.url.includes('/api/jobs/') && (Date.now() - reqTime) < 5000;
      });
      
      console.log(`[${elapsed}s] Recent job status requests (last 5s): ${recentRequests.length}`);
      
      // Check current page state
      const pageState = await page.evaluate(() => {
        const body = document.body.innerText;
        return {
          hasStarting: body.includes('Starting forecast'),
          hasProgress: body.includes('Progress:') || body.includes('%'),
          hasCompleted: body.includes('completed') || body.includes('Completed'),
          hasFailed: body.includes('failed') || body.includes('Failed'),
          snippet: body.substring(body.indexOf('Create New Forecast'), 
                                 body.indexOf('Create New Forecast') + 300)
        };
      });
      
      if (pageState.hasCompleted) {
        console.log('\n✅ Forecast completed!');
        break;
      } else if (pageState.hasFailed) {
        console.log('\n❌ Forecast failed!');
        break;
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total API requests: ${apiRequests.length}`);
  
  const jobRequests = apiRequests.filter(r => r.url.includes('/api/jobs/'));
  console.log(`Job status requests: ${jobRequests.length}`);
  
  if (jobRequests.length > 1) {
    const times = jobRequests.map(r => new Date(r.time).getTime());
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push((times[i] - times[i-1]) / 1000);
    }
    console.log(`Average interval: ${(intervals.reduce((a,b) => a+b, 0) / intervals.length).toFixed(1)}s`);
    console.log(`Intervals: ${intervals.map(i => i.toFixed(1) + 's').join(', ')}`);
  } else {
    console.log('⚠️  WARNING: Polling did not start! Only got initial request.');
  }
  
  // Take screenshot
  await page.screenshot({ 
    path: '/Users/winzendwyers/Forsight/foresight_analyzer/polling_debug.png',
    fullPage: true 
  });
  console.log('\n📸 Screenshot: polling_debug.png');
  
  // Check React Query DevTools state
  const reactQueryState = await page.evaluate(() => {
    // Try to access React Query state from window
    if (window.__REACT_QUERY_STATE__) {
      return window.__REACT_QUERY_STATE__;
    }
    return 'React Query state not accessible';
  });
  
  console.log('\n🔍 React Query State:', reactQueryState);
  
  console.log('\n⏳ Keeping browser open for 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
  console.log('✅ Done!');
})();
