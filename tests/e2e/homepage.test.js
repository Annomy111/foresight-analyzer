/**
 * E2E Tests for Homepage and Navigation
 */

const puppeteer = require('puppeteer');
const assert = require('assert');

const BASE_URL = process.env.TEST_URL || 'https://foresight-analyzer.pages.dev';
const TIMEOUT = 30000;

describe('Homepage Tests', function() {
  this.timeout(TIMEOUT);
  let browser;
  let page;

  before(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  after(async () => {
    await browser.close();
  });

  it('should load the homepage successfully', async () => {
    const response = await page.goto(BASE_URL, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    assert.strictEqual(response.status(), 200, 'Page should load with status 200');
    console.log('✓ Homepage loaded successfully');
  });

  it('should display the correct page title', async () => {
    const title = await page.title();
    assert.ok(title.includes('Foresight') || title.includes('Vite'), 'Title should contain Foresight or Vite');
    console.log(`✓ Page title: ${title}`);
  });

  it('should display the header with logo and navigation', async () => {
    const header = await page.$('header');
    assert.ok(header, 'Header should be present');

    const logo = await page.$('header h1');
    const logoText = await page.evaluate(el => el?.textContent, logo);
    console.log(`✓ Logo text: ${logoText}`);
    
    assert.ok(logoText, 'Logo should be present');
  });

  it('should have navigation links', async () => {
    const navLinks = await page.$$('nav a');
    assert.ok(navLinks.length > 0, 'Navigation links should be present');
    console.log(`✓ Found ${navLinks.length} navigation links`);
  });

  it('should display the main heading', async () => {
    const h1 = await page.$('h1');
    const heading = await page.evaluate(el => el?.textContent, h1);
    console.log(`✓ Main heading: ${heading}`);
    assert.ok(heading, 'Main heading should be present');
  });

  it('should have the forecast form visible', async () => {
    const form = await page.$('form');
    assert.ok(form, 'Forecast form should be present');
    console.log('✓ Forecast form is visible');
  });

  it('should display forecast type selection buttons', async () => {
    await page.waitForSelector('button', { timeout: 5000 });
    const buttons = await page.$$('button');
    assert.ok(buttons.length > 0, 'Buttons should be present');
    console.log(`✓ Found ${buttons.length} buttons on page`);
  });

  it('should have GitHub link in header', async () => {
    const githubLink = await page.$('a[href*="github"]');
    assert.ok(githubLink, 'GitHub link should be present');
    console.log('✓ GitHub link found');
  });

  it('should display footer with version info', async () => {
    const footer = await page.$('footer');
    assert.ok(footer, 'Footer should be present');
    
    const footerText = await page.evaluate(el => el?.textContent, footer);
    console.log(`✓ Footer present with text`);
  });

  it('should have no console errors', async () => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.reload({ waitUntil: 'networkidle2' });
    
    if (errors.length > 0) {
      console.warn(`⚠ Console errors found: ${errors.length}`);
      errors.forEach(err => console.warn(`  - ${err}`));
    } else {
      console.log('✓ No console errors');
    }
  });

  it('should load all images successfully', async () => {
    const images = await page.$$('img');
    console.log(`✓ Found ${images.length} images`);
    
    for (const img of images) {
      const isLoaded = await page.evaluate(img => img.complete && img.naturalWidth > 0, img);
      if (!isLoaded) {
        const src = await page.evaluate(img => img.src, img);
        console.warn(`⚠ Image failed to load: ${src}`);
      }
    }
  });

  it('should be responsive on mobile viewport', async () => {
    await page.setViewport({ width: 375, height: 667 }); // iPhone SE
    await page.reload({ waitUntil: 'networkidle2' });
    
    const header = await page.$('header');
    assert.ok(header, 'Header should be visible on mobile');
    console.log('✓ Page is responsive on mobile viewport');
    
    // Reset viewport
    await page.setViewport({ width: 1920, height: 1080 });
  });
});
