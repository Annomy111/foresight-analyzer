const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Puppeteer test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true // Open DevTools automatically
  });
  
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`❌ [BROWSER ERROR]: ${text}`);
    } else if (type === 'warning') {
      console.log(`⚠️  [BROWSER WARNING]: ${text}`);
    } else {
      console.log(`ℹ️  [BROWSER LOG]: ${text}`);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`💥 [PAGE ERROR]: ${error.message}`);
  });
  
  // Capture failed requests
  page.on('requestfailed', request => {
    console.log(`❌ [REQUEST FAILED]: ${request.url()}`);
    console.log(`   Failure: ${request.failure().errorText}`);
  });
  
  console.log('📱 Navigating to https://foresight-analyzer.pages.dev/\n');
  
  try {
    await page.goto('https://foresight-analyzer.pages.dev/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully!\n');
    
    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if #root exists and has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        exists: !!root,
        innerHTML: root ? root.innerHTML : null,
        innerHTMLLength: root ? root.innerHTML.length : 0,
        innerText: root ? root.innerText : null,
        childElementCount: root ? root.childElementCount : 0
      };
    });
    
    console.log('🔍 Root element inspection:');
    console.log(`   - Exists: ${rootContent.exists}`);
    console.log(`   - Has child elements: ${rootContent.childElementCount}`);
    console.log(`   - HTML length: ${rootContent.innerHTMLLength} chars`);
    console.log(`   - Inner text: ${rootContent.innerText ? rootContent.innerText.substring(0, 200) : '(empty)'}`);
    
    if (rootContent.innerHTMLLength > 0) {
      console.log(`   - First 500 chars of HTML:`);
      console.log(`     ${rootContent.innerHTML.substring(0, 500)}`);
    }
    
    // Check for specific elements
    const elements = await page.evaluate(() => {
      return {
        hasH1: !!document.querySelector('h1'),
        hasForm: !!document.querySelector('form'),
        hasButton: !!document.querySelector('button'),
        hasNav: !!document.querySelector('nav'),
        hasErrorBoundary: document.body.innerHTML.includes('Something went wrong'),
        hasLayout: document.body.innerHTML.includes('AI Foresight Analyzer'),
        visibleText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('\n🔍 Page content check:');
    console.log(`   - Has <h1>: ${elements.hasH1}`);
    console.log(`   - Has <form>: ${elements.hasForm}`);
    console.log(`   - Has <button>: ${elements.hasButton}`);
    console.log(`   - Has <nav>: ${elements.hasNav}`);
    console.log(`   - Shows error boundary: ${elements.hasErrorBoundary}`);
    console.log(`   - Has "AI Foresight Analyzer": ${elements.hasLayout}`);
    console.log(`   - Visible text: ${elements.visibleText || '(empty)'}`);
    
    // Take a screenshot
    const screenshotPath = '/Users/winzendwyers/Forsight/foresight_analyzer/puppeteer_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved to: ${screenshotPath}`);
    
    // Check computed styles of root
    const rootStyles = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return null;
      const styles = window.getComputedStyle(root);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        height: styles.height,
        width: styles.width,
        position: styles.position
      };
    });
    
    console.log('\n🎨 Root element styles:');
    console.log(JSON.stringify(rootStyles, null, 2));
    
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
  }
  
  await browser.close();
  console.log('\n✅ Test complete!');
})();
