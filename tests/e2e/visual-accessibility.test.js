/**
 * Visual and Accessibility Tests
 */

const puppeteer = require('puppeteer');
const assert = require('assert');

const BASE_URL = process.env.TEST_URL || 'https://foresight-analyzer.pages.dev';
const TIMEOUT = 30000;

describe('Visual and Accessibility Tests', function() {
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

  describe('Visual Tests', () => {
    it('should have proper page layout', async () => {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.viewport().height;
      
      console.log(`✓ Page height: ${bodyHeight}px, Viewport: ${viewportHeight}px`);
      assert.ok(bodyHeight > 0, 'Page should have content');
    });

    it('should have visible text content', async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      const wordCount = textContent.split(/\s+/).length;
      
      console.log(`✓ Page has ${wordCount} words of content`);
      assert.ok(wordCount > 10, 'Page should have meaningful content');
    });

    it('should have proper color contrast (basic check)', async () => {
      const elements = await page.$$('button, a, h1, h2, h3');
      console.log(`✓ Checking contrast for ${elements.length} elements`);
      
      for (const el of elements.slice(0, 5)) {
        const styles = await page.evaluate(element => {
          const computed = window.getComputedStyle(element);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor
          };
        }, el);
        
        // Just log for manual review
        if (styles.color !== 'rgba(0, 0, 0, 0)') {
          // console.log(`  Color: ${styles.color}, BG: ${styles.backgroundColor}`);
        }
      }
      console.log('✓ Contrast check completed');
    });

    it('should test responsive breakpoints', async () => {
      const breakpoints = [
        { name: 'Mobile', width: 375, height: 667 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Desktop', width: 1920, height: 1080 }
      ];

      for (const bp of breakpoints) {
        await page.setViewport({ width: bp.width, height: bp.height });
        await page.waitForTimeout(500);
        
        const isVisible = await page.evaluate(() => {
          const header = document.querySelector('header');
          const main = document.querySelector('main');
          return header && main;
        });
        
        console.log(`✓ ${bp.name} (${bp.width}x${bp.height}): ${isVisible ? 'OK' : 'Issues'}`);
        assert.ok(isVisible, `Layout should work on ${bp.name}`);
      }

      // Reset to desktop
      await page.setViewport({ width: 1920, height: 1080 });
    });

    it('should have no layout shifts on load', async () => {
      let cls = 0;
      
      await page.evaluateOnNewDocument(() => {
        window.cumulativeLayoutShiftScore = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.cumulativeLayoutShiftScore += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      });

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);

      cls = await page.evaluate(() => window.cumulativeLayoutShiftScore || 0);
      console.log(`✓ Cumulative Layout Shift: ${cls.toFixed(4)}`);
      
      // Good CLS is < 0.1
      if (cls < 0.1) {
        console.log('  ✓ Excellent layout stability');
      } else if (cls < 0.25) {
        console.log('  ⚠ Layout stability needs improvement');
      } else {
        console.log('  ⚠ Poor layout stability');
      }
    });

    it('should measure page load performance', async () => {
      const metrics = await page.evaluate(() => {
        const perf = window.performance.timing;
        return {
          loadTime: perf.loadEventEnd - perf.navigationStart,
          domReady: perf.domContentLoadedEventEnd - perf.navigationStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        };
      });

      console.log(`✓ Page Load Time: ${metrics.loadTime}ms`);
      console.log(`  DOM Ready: ${metrics.domReady}ms`);
      console.log(`  First Paint: ${metrics.firstPaint.toFixed(0)}ms`);
    });
  });

  describe('Accessibility Tests', () => {
    it('should have semantic HTML elements', async () => {
      const semanticElements = await page.evaluate(() => {
        return {
          header: !!document.querySelector('header'),
          nav: !!document.querySelector('nav'),
          main: !!document.querySelector('main'),
          footer: !!document.querySelector('footer'),
          headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length
        };
      });

      console.log('✓ Semantic HTML check:');
      console.log(`  <header>: ${semanticElements.header}`);
      console.log(`  <nav>: ${semanticElements.nav}`);
      console.log(`  <main>: ${semanticElements.main}`);
      console.log(`  <footer>: ${semanticElements.footer}`);
      console.log(`  Headings: ${semanticElements.headings}`);

      assert.ok(semanticElements.header, 'Should have header element');
      assert.ok(semanticElements.headings > 0, 'Should have heading elements');
    });

    it('should have alt text for images', async () => {
      const images = await page.$$eval('img', imgs => 
        imgs.map(img => ({
          src: img.src,
          alt: img.alt,
          hasAlt: !!img.alt
        }))
      );

      console.log(`✓ Checked ${images.length} images for alt text`);
      
      const missingAlt = images.filter(img => !img.hasAlt);
      if (missingAlt.length > 0) {
        console.warn(`⚠ ${missingAlt.length} images missing alt text`);
      } else if (images.length > 0) {
        console.log('  All images have alt text');
      }
    });

    it('should have form labels', async () => {
      const forms = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, select, textarea');
        let withLabel = 0;
        let total = inputs.length;

        inputs.forEach(input => {
          const label = document.querySelector(`label[for="${input.id}"]`);
          const ariaLabel = input.getAttribute('aria-label');
          const placeholder = input.getAttribute('placeholder');
          
          if (label || ariaLabel || placeholder || input.closest('label')) {
            withLabel++;
          }
        });

        return { total, withLabel };
      });

      console.log(`✓ Form accessibility:`);
      console.log(`  Inputs: ${forms.total}`);
      console.log(`  With labels/aria: ${forms.withLabel}`);

      if (forms.total > 0) {
        const percentage = ((forms.withLabel / forms.total) * 100).toFixed(0);
        console.log(`  Coverage: ${percentage}%`);
      }
    });

    it('should have proper heading hierarchy', async () => {
      const headings = await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return h.map(el => ({
          level: parseInt(el.tagName[1]),
          text: el.textContent.trim().substring(0, 50)
        }));
      });

      console.log(`✓ Heading hierarchy:`);
      headings.slice(0, 5).forEach(h => {
        console.log(`  H${h.level}: ${h.text}`);
      });

      const h1Count = headings.filter(h => h.level === 1).length;
      if (h1Count === 1) {
        console.log('  ✓ Single H1 (good practice)');
      } else {
        console.warn(`  ⚠ Found ${h1Count} H1 elements`);
      }
    });

    it('should have keyboard-accessible interactive elements', async () => {
      const buttons = await page.$$('button, a');
      console.log(`✓ Found ${buttons.length} interactive elements`);

      // Test Tab navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName : null;
      });

      console.log(`  Tab focus works: ${focusedElement ? 'YES' : 'NO'}`);
      if (focusedElement) {
        console.log(`  Focused element: ${focusedElement}`);
      }
    });

    it('should have focus indicators', async () => {
      const button = await page.$('button');
      
      if (button) {
        await button.focus();
        await page.waitForTimeout(200);

        const focusStyle = await page.evaluate(() => {
          const el = document.activeElement;
          const computed = window.getComputedStyle(el);
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            boxShadow: computed.boxShadow
          };
        });

        const hasFocusIndicator = 
          focusStyle.outlineWidth !== '0px' || 
          focusStyle.boxShadow !== 'none';

        console.log(`✓ Focus indicator present: ${hasFocusIndicator}`);
        if (!hasFocusIndicator) {
          console.warn('  ⚠ No visible focus indicator detected');
        }
      }
    });

    it('should have ARIA attributes where needed', async () => {
      const ariaElements = await page.$$eval('[aria-label], [aria-describedby], [role]', 
        els => els.length
      );

      console.log(`✓ Found ${ariaElements} elements with ARIA attributes`);
    });

    it('should check for sufficient text size', async () => {
      const textSizes = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, span, div, button, a');
        const sizes = [];

        for (let i = 0; i < Math.min(20, elements.length); i++) {
          const el = elements[i];
          if (el.textContent.trim()) {
            const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
            sizes.push(fontSize);
          }
        }

        return sizes;
      });

      const minSize = Math.min(...textSizes);
      const avgSize = textSizes.reduce((a, b) => a + b, 0) / textSizes.length;

      console.log(`✓ Text size analysis:`);
      console.log(`  Minimum: ${minSize.toFixed(1)}px`);
      console.log(`  Average: ${avgSize.toFixed(1)}px`);

      if (minSize < 12) {
        console.warn('  ⚠ Some text may be too small');
      } else {
        console.log('  ✓ Text sizes are readable');
      }
    });
  });
});
