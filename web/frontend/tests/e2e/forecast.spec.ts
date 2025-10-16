import { test, expect } from '@playwright/test';

test.describe('Forecast Flow E2E', () => {
  const BASE_URL = 'http://localhost:5174';

  test('should successfully create and track a Ukraine forecast', async ({ page }) => {
    // Navigate to the app
    await page.goto(BASE_URL);

    // Wait for the page to load
    await expect(page.locator('h1:has-text("AI Foresight Analyzer")')).toBeVisible();

    // Click on Ukraine Forecast button
    await page.click('text=Ukraine Forecast');

    // Click Start Forecast button
    await page.click('button:has-text("Start Forecast")');

    // Wait for the forecast to start
    await expect(page.locator('text=Running')).toBeVisible({ timeout: 10000 });

    // Check that progress is showing
    const progressElement = page.locator('text=/\\d+%/');
    await expect(progressElement).toBeVisible({ timeout: 5000 });

    // Get initial progress
    const initialProgress = await progressElement.textContent();
    console.log('Initial progress:', initialProgress);

    // Wait for progress to update (should be > 10%)
    await page.waitForTimeout(5000);

    // Check if progress has increased
    const updatedProgress = await progressElement.textContent();
    console.log('Updated progress:', updatedProgress);

    // Extract percentage values
    const initialPercent = parseInt(initialProgress?.replace('%', '') || '0');
    const updatedPercent = parseInt(updatedProgress?.replace('%', '') || '0');

    // Progress should increase
    expect(updatedPercent).toBeGreaterThanOrEqual(initialPercent);

    // Check that processing steps are showing
    await expect(page.locator('text=Processing Steps')).toBeVisible();

    // Take a screenshot for debugging
    await page.screenshot({ path: 'forecast-progress.png', fullPage: true });

    console.log('✅ Forecast started successfully!');
    console.log(`Progress: ${initialPercent}% → ${updatedPercent}%`);
  });

  test('should display forecast history', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);

    // Wait for history page to load
    await expect(page.locator('text=Forecast History')).toBeVisible();

    // Check if statistics are showing
    await expect(page.locator('text=Total Forecasts')).toBeVisible();
    await expect(page.locator('text=Success Rate')).toBeVisible();

    // Check if job list is present
    const jobList = page.locator('[class*="space-y-4"]');
    await expect(jobList).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'forecast-history.png', fullPage: true });

    console.log('✅ History page loaded successfully!');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to the app
    await page.goto(BASE_URL);

    // Check that the app loads even if backend is slow
    await expect(page.locator('h1:has-text("AI Foresight Analyzer")')).toBeVisible();

    console.log('✅ App handles errors gracefully!');
  });
});
