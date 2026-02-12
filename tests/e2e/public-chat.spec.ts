import { test, expect } from '@playwright/test'
import { createDeployableAgent, deleteAgent } from './helpers'

test.describe('Public Chat Page', () => {
  let agentId: string
  let agentSlug: string

  test.beforeEach(async ({ request }) => {
    const agent = await createDeployableAgent(request)
    agentId = agent.id
    agentSlug = agent.slug

    // Deploy the agent
    const deployRes = await request.post(`/api/agents/${agentId}/deploy`)
    if (!deployRes.ok()) {
      throw new Error(`Failed to deploy: ${deployRes.status()} ${await deployRes.text()}`)
    }
  })

  test.afterEach(async ({ request }) => {
    if (agentId) {
      await deleteAgent(request, agentId)
    }
  })

  test('shows agent name, emoji, and greeting on load', async ({ page }) => {
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    // Agent name
    await expect(page.locator('span.font-semibold').filter({ hasText: 'TestBot' })).toBeVisible()

    // Greeting message
    await expect(page.getByText('Hi! I am TestBot, ready for E2E testing.')).toBeVisible()
  })

  test('Powered by Agent OS footer visible', async ({ page }) => {
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Powered by Agent OS')).toBeVisible()
  })

  test('message input has correct placeholder', async ({ page }) => {
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder('Message TestBot...')
    await expect(input).toBeVisible()
  })

  test('send a message and get a response', async ({ page }) => {
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    // Type and send
    const input = page.getByPlaceholder('Message TestBot...')
    await input.fill('Hello TestBot!')
    await page.getByRole('button', { name: /send/i }).or(page.locator('button[type="submit"]')).click()

    // User message should appear
    await expect(page.getByText('Hello TestBot!')).toBeVisible()

    // Wait for response (loading indicator disappears)
    await expect(page.getByText(/is thinking/i)).toBeVisible({ timeout: 5000 }).catch(() => {})
    // Wait for response to appear (any assistant message after the greeting)
    await page.waitForSelector('.chat-bubble-assistant:nth-child(n+2), .justify-start:nth-child(n+3)', {
      timeout: 30000,
    }).catch(() => {})

    // Turn counter should appear
    await expect(page.getByText(/1 of 3 turns/i)).toBeVisible({ timeout: 10000 })
  })

  test('session ends after max turns (3)', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder('Message TestBot...')
    const submit = page.getByRole('button', { name: /send/i }).or(page.locator('button[type="submit"]'))

    // Send 3 messages
    for (let i = 1; i <= 3; i++) {
      await input.fill(`Turn ${i}`)
      await submit.click()

      // Wait for response
      if (i < 3) {
        await expect(page.getByText(`${i} of 3 turns`)).toBeVisible({ timeout: 30000 })
      }
    }

    // After 3 turns, should show session ended message
    await expect(page.getByText(/this conversation has ended/i)).toBeVisible({ timeout: 30000 })

    // Start new conversation button should appear
    await expect(page.getByRole('button', { name: /start new conversation/i })).toBeVisible()
  })

  test('clicking Start new conversation resets', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder('Message TestBot...')
    const submit = page.getByRole('button', { name: /send/i }).or(page.locator('button[type="submit"]'))

    // Send 3 messages to end session
    for (let i = 1; i <= 3; i++) {
      await input.fill(`Turn ${i}`)
      await submit.click()
      if (i < 3) {
        await expect(page.getByText(`${i} of 3 turns`)).toBeVisible({ timeout: 30000 })
      }
    }

    await expect(page.getByText(/this conversation has ended/i)).toBeVisible({ timeout: 30000 })

    // Click Start new conversation
    await page.getByRole('button', { name: /start new conversation/i }).click()

    // Should show greeting again and input should be visible
    await expect(page.getByText('Hi! I am TestBot, ready for E2E testing.')).toBeVisible()
    await expect(page.getByPlaceholder('Message TestBot...')).toBeVisible()
  })

  test('404 for non-existent slug shows error', async ({ page }) => {
    await page.goto('/a/nonexistent-agent-xyz')
    await page.waitForLoadState('networkidle')

    // Should show error message
    await expect(
      page.getByText(/agent not found|not deployed/i)
    ).toBeVisible({ timeout: 10000 })

    // Input should NOT be visible
    await expect(page.getByPlaceholder(/message/i)).not.toBeVisible()
  })

  test('paused agent shows error', async ({ request, page }) => {
    // Pause the deployment
    await request.delete(`/api/agents/${agentId}/deploy`)

    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    // Should show error
    await expect(
      page.getByText(/agent not found|not deployed|unavailable/i)
    ).toBeVisible({ timeout: 10000 })
  })

  test('send button disabled when input empty', async ({ page }) => {
    await page.goto(`/a/${agentSlug}`)
    await page.waitForLoadState('networkidle')

    const submit = page.locator('button[type="submit"]')
    await expect(submit).toBeDisabled()
  })
})
