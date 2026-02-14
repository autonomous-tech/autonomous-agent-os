// =============================================================================
// Agent OS -- E2E Tests: Deploy Flow (Header-based deploy controls)
// =============================================================================
// Tests the deploy, pause, resume, and redeploy flow from the builder page.
// Deploy controls are in the header bar (not a footer). The deployment badge
// shows "Live v{N}" or "Paused" in the header breadcrumb area.
// =============================================================================

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

  test('clicking Deploy shows Live badge with version', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Click Deploy
    const deployButton = page.getByRole('button', { name: /^deploy$/i })
    await deployButton.click()

    // Wait for the deploy success dialog or the Live badge to appear
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Should show Pause and Redeploy buttons in the header
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /redeploy/i })).toBeVisible()
  })

  test('clicking Pause shows Paused badge', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy first
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Close deploy success dialog if it appeared
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    }

    // Pause
    await page.getByRole('button', { name: /pause/i }).click()
    await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 10000 })

    // Should show Resume button
    await expect(page.getByRole('button', { name: /resume/i })).toBeVisible()
  })

  test('clicking Resume goes back to Live state', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Close deploy success dialog if it appeared
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    }

    // Pause
    await page.getByRole('button', { name: /pause/i }).click()
    await expect(page.getByText(/paused/i)).toBeVisible({ timeout: 10000 })

    // Resume
    await page.getByRole('button', { name: /resume/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })
  })

  test('redeploy increments version', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy v1
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Close deploy success dialog if it appeared
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    }

    // Redeploy to v2
    await page.getByRole('button', { name: /redeploy/i }).click()
    await expect(page.getByText(/live v2/i)).toBeVisible({ timeout: 10000 })
  })

  test('deploy state persists after page reload', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Reload
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should still show live indicator
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })
  })

  test('header shows Try It, deploy controls, and Export together', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Close deploy success dialog if it appeared
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    }

    // All buttons should be visible in the header
    await expect(page.getByRole('button', { name: /try it/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    // Either Pause or Redeploy should be visible (deploy controls)
    const hasPause = await page.getByRole('button', { name: /pause/i }).isVisible()
    const hasRedeploy = await page.getByRole('button', { name: /redeploy/i }).isVisible()
    expect(hasPause || hasRedeploy).toBe(true)
  })

  test('deploy success dialog shows public URL', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()

    // Deploy success dialog should appear
    await expect(page.getByText('Agent Deployed')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Your agent is now live and accessible.')).toBeVisible()

    // Should have an "Open Agent" button
    await expect(page.getByRole('button', { name: /open agent/i })).toBeVisible()
  })

  test('Workspace link appears after deployment', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Deploy
    await page.getByRole('button', { name: /^deploy$/i }).click()
    await expect(page.getByText(/live v1/i)).toBeVisible({ timeout: 10000 })

    // Close deploy success dialog if it appeared
    const closeBtn = page.getByRole('button', { name: /close/i })
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()
    }

    // Workspace link should be visible in header
    const workspaceLink = page.getByText('Workspace')
    await expect(workspaceLink).toBeVisible()
  })
})
