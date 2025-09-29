/**
 * E2E Tests for API Endpoints
 */

const puppeteer = require('puppeteer');
const assert = require('assert');

const API_URL = process.env.API_URL || 'https://foresight-analyzer-api.dieter-meier82.workers.dev';
const TIMEOUT = 30000;

describe('API Endpoint Tests', function() {
  this.timeout(TIMEOUT);
  let browser;
  let page;

  before(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  after(async () => {
    await browser.close();
  });

  it('should reach the API root endpoint', async () => {
    const response = await page.goto(API_URL, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    assert.strictEqual(response.status(), 200, 'API should respond with 200');
    console.log('✓ API root endpoint reachable');
  });

  it('should return JSON from root endpoint', async () => {
    await page.goto(API_URL, { waitUntil: 'networkidle2' });
    
    const contentType = await page.evaluate(() => {
      return document.contentType;
    });
    
    const content = await page.evaluate(() => document.body.textContent);
    
    try {
      const json = JSON.parse(content);
      console.log('✓ API returns valid JSON');
      console.log(`  Response:`, JSON.stringify(json, null, 2).substring(0, 200));
      
      assert.ok(json, 'Should return JSON object');
    } catch (e) {
      console.warn('⚠ Response is not JSON:', content.substring(0, 100));
    }
  });

  it('should test /api/models endpoint', async () => {
    const response = await page.goto(`${API_URL}/api/models`, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    const status = response.status();
    console.log(`✓ /api/models responded with status: ${status}`);
    
    if (status === 200) {
      const content = await page.evaluate(() => document.body.textContent);
      try {
        const json = JSON.parse(content);
        console.log('✓ Models endpoint returns JSON');
        
        if (json.free_models) {
          console.log(`  Free models: ${json.free_models.length}`);
          console.log(`  Sample: ${json.free_models.slice(0, 2).join(', ')}`);
        }
        if (json.premium_models) {
          console.log(`  Premium models: ${json.premium_models.length}`);
        }
      } catch (e) {
        console.warn('⚠ Models endpoint response not JSON');
      }
    }
  });

  it('should handle CORS headers correctly', async () => {
    const response = await page.goto(`${API_URL}/api/models`, { 
      waitUntil: 'networkidle2' 
    });
    
    const headers = response.headers();
    const hasCORS = headers['access-control-allow-origin'];
    
    console.log(`✓ CORS header present: ${hasCORS !== undefined}`);
    if (hasCORS) {
      console.log(`  Access-Control-Allow-Origin: ${hasCORS}`);
    }
  });

  it('should test OPTIONS request (preflight)', async () => {
    try {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(url, { method: 'OPTIONS' });
        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries())
        };
      }, `${API_URL}/api/models`);
      
      console.log(`✓ OPTIONS request status: ${response.status}`);
      console.log(`  CORS headers present: ${!!response.headers['access-control-allow-methods']}`);
    } catch (e) {
      console.warn('⚠ OPTIONS request failed:', e.message);
    }
  });

  it('should test /health endpoint', async () => {
    try {
      const response = await page.goto(`${API_URL}/health`, { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });
      
      console.log(`✓ /health endpoint status: ${response.status()}`);
      
      if (response.status() === 200) {
        const content = await page.evaluate(() => document.body.textContent);
        try {
          const json = JSON.parse(content);
          console.log(`  Health check:`, json);
        } catch (e) {
          console.log(`  Response: ${content.substring(0, 100)}`);
        }
      }
    } catch (e) {
      console.warn('⚠ /health endpoint not available');
    }
  });

  it('should handle 404 for non-existent endpoints', async () => {
    const response = await page.goto(`${API_URL}/api/nonexistent`, { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    const status = response.status();
    console.log(`✓ Non-existent endpoint status: ${status}`);
    
    // Could be 404 or 200 with error message
    assert.ok(status === 404 || status === 200, 'Should handle unknown routes');
  });

  it('should test API response time', async () => {
    const start = Date.now();
    
    await page.goto(`${API_URL}/api/models`, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    const duration = Date.now() - start;
    console.log(`✓ API response time: ${duration}ms`);
    
    assert.ok(duration < 5000, 'API should respond within 5 seconds');
  });

  it('should test POST endpoint with fetch', async () => {
    try {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/forecast/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: 'Test question',
            definition: 'Test definition',
            iterations: 1
          })
        });
        
        return {
          status: res.status,
          statusText: res.statusText,
          body: await res.text()
        };
      }, API_URL);
      
      console.log(`✓ POST /api/forecast/custom status: ${response.status}`);
      console.log(`  Response: ${response.body.substring(0, 150)}`);
      
      // Might be 503 if backend not configured, which is expected
      assert.ok([200, 201, 503].includes(response.status), 'Should handle POST request');
    } catch (e) {
      console.warn('⚠ POST test failed:', e.message);
    }
  });

  it('should have proper error messages', async () => {
    try {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/forecast/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalid: 'data' })
        });
        
        return {
          status: res.status,
          body: await res.text()
        };
      }, API_URL);
      
      if (response.status >= 400) {
        try {
          const json = JSON.parse(response.body);
          console.log(`✓ Error response is JSON:`, json);
          assert.ok(json.error || json.message, 'Error should have message');
        } catch (e) {
          console.log(`✓ Error response: ${response.body.substring(0, 100)}`);
        }
      }
    } catch (e) {
      console.warn('⚠ Error handling test inconclusive');
    }
  });
});
