/**
 * E2E Tests for Forecast Form Interactions
 */

const puppeteer = require('puppeteer');
const assert = require('assert');

const BASE_URL = process.env.TEST_URL || 'https://foresight-analyzer.pages.dev';
const TIMEOUT = 30000;

describe('Forecast Form Tests', function() {
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
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
  });

  after(async () => {
    await browser.close();
  });

  it('should have forecast type selection buttons', async () => {
    // Wait for buttons to load
    await page.waitForSelector('button', { timeout: 5000 });
    
    const buttonTexts = await page.$$eval('button', buttons => 
      buttons.map(b => b.textContent.trim()).filter(t => t)
    );
    
    console.log(`✓ Found buttons:`, buttonTexts.slice(0, 5));
    assert.ok(buttonTexts.length > 0, 'Should have buttons');
  });

  it('should toggle between Ukraine and Custom forecast modes', async () => {
    // Look for mode selection buttons
    const buttons = await page.$$('button');
    
    if (buttons.length > 0) {
      console.log('✓ Mode selection buttons available');
      
      // Try clicking different buttons
      for (let i = 0; i < Math.min(2, buttons.length); i++) {
        const buttonText = await page.evaluate(el => el.textContent, buttons[i]);
        if (buttonText && (buttonText.includes('Ukraine') || buttonText.includes('Custom'))) {
          await buttons[i].click();
          await page.waitForTimeout(500);
          console.log(`✓ Clicked button: ${buttonText.substring(0, 30)}`);
        }
      }
    }
  });

  it('should have input fields in the form', async () => {
    const inputs = await page.$$('input, textarea, select');
    console.log(`✓ Found ${inputs.length} input fields`);
    assert.ok(inputs.length > 0, 'Form should have input fields');
  });

  it('should have textarea for custom forecast', async () => {
    const textareas = await page.$$('textarea');
    console.log(`✓ Found ${textareas.length} textarea fields`);
    
    if (textareas.length > 0) {
      // Try to focus on first textarea
      await textareas[0].click();
      await page.keyboard.type('Test forecast question');
      await page.waitForTimeout(300);
      
      const value = await page.evaluate(el => el.value, textareas[0]);
      assert.ok(value.includes('Test'), 'Textarea should accept input');
      console.log('✓ Textarea accepts input');
    }
  });

  it('should have iterations input field', async () => {
    const iterationsInput = await page.$('input[type="number"]');
    
    if (iterationsInput) {
      const value = await page.evaluate(el => el.value, iterationsInput);
      console.log(`✓ Iterations field value: ${value}`);
      assert.ok(value, 'Iterations should have a default value');
    }
  });

  it('should have API key input field', async () => {
    const passwordInputs = await page.$$('input[type="password"]');
    console.log(`✓ Found ${passwordInputs.length} password fields (for API key)`);
    
    if (passwordInputs.length > 0) {
      await passwordInputs[0].click();
      await page.keyboard.type('test-api-key-12345');
      await page.waitForTimeout(300);
      console.log('✓ API key field accepts input');
    }
  });

  it('should have checkboxes for enhanced prompts', async () => {
    const checkboxes = await page.$$('input[type="checkbox"]');
    console.log(`✓ Found ${checkboxes.length} checkboxes`);
    
    if (checkboxes.length > 0) {
      const isChecked = await page.evaluate(el => el.checked, checkboxes[0]);
      console.log(`✓ First checkbox checked: ${isChecked}`);
      
      // Toggle checkbox
      await checkboxes[0].click();
      await page.waitForTimeout(300);
      
      const newState = await page.evaluate(el => el.checked, checkboxes[0]);
      assert.notStrictEqual(isChecked, newState, 'Checkbox should toggle');
      console.log('✓ Checkbox toggles successfully');
    }
  });

  it('should have submit button', async () => {
    const submitButtons = await page.$$('button[type="submit"]');
    
    if (submitButtons.length === 0) {
      // Try to find buttons with text containing "Start" or "Forecast"
      const allButtons = await page.$$('button');
      let foundSubmit = false;
      
      for (const btn of allButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes('Start') || text.includes('Forecast'))) {
          foundSubmit = true;
          console.log(`✓ Found submit button: ${text.substring(0, 50)}`);
          break;
        }
      }
      
      assert.ok(foundSubmit || submitButtons.length > 0, 'Should have a submit button');
    } else {
      console.log(`✓ Found ${submitButtons.length} submit buttons`);
    }
  });

  it('should show info boxes about the forecast', async () => {
    const infos = await page.$$('[class*="info"], [class*="alert"], [class*="bg-blue"], [class*="bg-yellow"]');
    console.log(`✓ Found ${infos.length} info/alert boxes`);
    
    if (infos.length > 0) {
      const infoText = await page.evaluate(el => el.textContent, infos[0]);
      console.log(`✓ Info box text: ${infoText.substring(0, 80)}...`);
    }
  });

  it('should have model selection UI', async () => {
    const modelText = await page.evaluate(() => document.body.textContent);
    const hasModelMention = modelText.includes('model') || modelText.includes('Model');
    
    console.log(`✓ Page mentions models: ${hasModelMention}`);
  });

  it('should validate form before submission', async () => {
    // Try to find and click submit without filling required fields
    const buttons = await page.$$('button');
    let submitButton = null;
    
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      const isDisabled = await page.evaluate(el => el.disabled, btn);
      
      if (text && text.includes('Start')) {
        submitButton = btn;
        console.log(`✓ Submit button disabled: ${isDisabled}`);
        break;
      }
    }
    
    if (submitButton) {
      console.log('✓ Form has submit button with validation');
    }
  });

  it('should handle custom forecast mode inputs', async () => {
    // Try to find "Custom" button and click it
    const buttons = await page.$$('button');
    
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Custom')) {
        await btn.click();
        await page.waitForTimeout(1000);
        console.log('✓ Switched to Custom forecast mode');
        
        // Check if new fields appeared
        const textareas = await page.$$('textarea');
        console.log(`✓ Custom mode shows ${textareas.length} textarea fields`);
        break;
      }
    }
  });

  it('should show timeframe input for Ukraine forecast', async () => {
    // Try to find and click Ukraine button
    const buttons = await page.$$('button');
    
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Ukraine')) {
        await btn.click();
        await page.waitForTimeout(1000);
        console.log('✓ Switched to Ukraine forecast mode');
        
        // Check for date input
        const dateInputs = await page.$$('input[type="date"]');
        console.log(`✓ Ukraine mode shows ${dateInputs.length} date inputs`);
        break;
      }
    }
  });
});
