const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing forecast submission...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false
  });
  
  const page = await browser.newPage();
  
  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}]: ${text}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`💥 [PAGE ERROR]: ${error.message}`);
  });
  
  // Capture failed requests
  page.on('requestfailed', request => {
    console.log(`❌ [REQUEST FAILED]: ${request.url()}`);
  });
  
  // Track network requests
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`📤 [API REQUEST]: ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      console.log(`📥 [API RESPONSE]: ${status} ${response.url()}`);
      if (status >= 400) {
        const text = await response.text().catch(() => 'Could not read response');
        console.log(`   Error body: ${text.substring(0, 200)}`);
      }
    }
  });
  
  console.log('📱 Navigating to frontend...\n');
  await page.goto('https://foresight-analyzer.pages.dev/', { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });
  
  console.log('✅ Page loaded!\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Fill in the API key
  console.log('🔑 Filling in API key...');
  await page.type('input[placeholder*="sk-or" i]', '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');
  
  // Set iterations to 1 for quick test
  console.log('⚙️  Setting iterations to 1...');
  const iterationsInput = await page.$('input[type="number"]');
  if (iterationsInput) {
    await iterationsInput.click({ clickCount: 3 }); // Select all
    await iterationsInput.type('1');
  }
  
  console.log('🖱️  Clicking "Start Ukraine Forecast" button...\n');
  
  // Find and click the submit button
  const submitButton = await page.$('button[type="submit"]');
  if (!submitButton) {
    console.log('❌ Submit button not found!');
    await browser.close();
    return;
  }
  
  await submitButton.click();
  
  console.log('⏳ Waiting for response...\n');
  
  // Wait and watch what happens
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check if progress display appeared
  const hasProgress = await page.evaluate(() => {
    const text = document.body.innerText;
    const root = document.getElementById('root');
    return {
      hasProgressBar: !!document.querySelector('[role="progressbar"]'),
      hasJobId: text.includes('Job ID'),
      hasStatus: text.includes('Status:') || text.includes('pending') || text.includes('running'),
      hasStartingText: text.includes('Starting forecast'),
      hasLoader: !!document.querySelector('.animate-spin'),
      rootHTML: root ? root.innerHTML.substring(0, 500) : '',
      bodyText: text.substring(0, 1000)
    };
  });
  
  console.log('🔍 After submit check:');
  console.log(`   - Has progress bar: ${hasProgress.hasProgressBar}`);
  console.log(`   - Has Job ID: ${hasProgress.hasJobId}`);
  console.log(`   - Has Status: ${hasProgress.hasStatus}`);
  console.log(`   - Has "Starting forecast": ${hasProgress.hasStartingText}`);
  console.log(`   - Has loader spinner: ${hasProgress.hasLoader}`);
  console.log(`   - Root HTML: ${hasProgress.rootHTML}`);
  
  // Wait for job to complete or timeout
  console.log('\n⏳ Monitoring for 30 seconds...\n');
  
  for (let i = 0; i < 15; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasCompleted: body.includes('completed') || body.includes('Completed'),
        hasFailed: body.includes('failed') || body.includes('Failed'),
        hasError: body.includes('Error') || body.includes('error'),
        currentText: body.substring(0, 500)
      };
    });
    
    console.log(`[${i+1}] Status check: completed=${status.hasCompleted}, failed=${status.hasFailed}, error=${status.hasError}`);
    
    if (status.hasCompleted || status.hasFailed) {
      console.log(`\n✅ Forecast finished!`);
      console.log(`Current page text:\n${status.currentText}`);
      break;
    }
  }
  
  // Take final screenshot
  await page.screenshot({ 
    path: '/Users/winzendwyers/Forsight/foresight_analyzer/puppeteer_after_submit.png',
    fullPage: true 
  });
  console.log('\n📸 Screenshot saved: puppeteer_after_submit.png');
  
  console.log('\n⏳ Keeping browser open for 15 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  await browser.close();
  console.log('✅ Test complete!');
})();
