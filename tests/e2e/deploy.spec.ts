import { test, expect } from '@playwright/test'
import { createDeployableAgent, deleteAgent } from './helpers'

test.describe('Deploy Flow', () => {
  let agentId: string
  let agentSlug: string

  test.beforeEach(async ({ request }) => {
    const agent = await createDeployableAgent(request)
    agentId = agent.id
    agentSlug = agent.slug
  })

  test.afterEach(async ({ request }) => {
    if (agentId) {
      await deleteAgent(request, agentId)
    }
  })

  test('shows Deploy button when agent is not deployed', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const deployButton = page.getByRole('button', { name: /^deploy$/i })
    await expect(deployButton).toBeVisible()
  })

  test('clicking Deploy shows Live indicator with version', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Click Deploy
    const deployButton = page.getByRole('button', { name: /^deploy$/i })
    await deployButton.click()

    // Wait for deployment to complete
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    // Should show Pause and Redeploy buttons
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /redeploy/i })).toBeVisible()

    // Should show public URL link
    const publicLink = page.locator(`a[href="/a/${agentSlug}"][target="_blank"]`)
    await expect(publicLink).toBeVisible()
  })

  test('clicking Pause shows Paused indicator', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy first
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    // Pause
    await page.getByRole('button', { name: /pause/i }).click()
    await expect(page.getByText(/paused — v1/i)).toBeVisible({ timeout: 10000 })

    // Should show Resume button
    await expect(page.getByRole('button', { name: /resume/i })).toBeVisible()

    // Public URL link should NOT be visible when paused
    const publicLink = page.locator(`a[href="/a/${agentSlug}"][target="_blank"]`)
    await expect(publicLink).not.toBeVisible()
  })

  test('clicking Resume goes back to Live state', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy → Pause → Resume
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /pause/i }).click()
    await expect(page.getByText(/paused — v1/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /resume/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })
  })

  test('redeploy increments version', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy v1
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    // Redeploy to v2
    await page.getByRole('button', { name: /redeploy/i }).click()
    await expect(page.getByText(/live — v2/i)).toBeVisible({ timeout: 10000 })
  })

  test('deploy state persists after page reload', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    // Reload
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should still show live indicator
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })
  })

  test('footer shows Try It, deploy state, and Export together', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live — v1/i)).toBeVisible({ timeout: 10000 })

    // All three buttons should be visible
    await expect(page.getByRole('button', { name: /try it/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
    // Either Pause or Redeploy should be visible (deploy controls)
    const hasPause = await page.getByRole('button', { name: /pause/i }).isVisible()
    const hasRedeploy = await page.getByRole('button', { name: /redeploy/i }).isVisible()
    expect(hasPause || hasRedeploy).toBe(true)
  })
})
