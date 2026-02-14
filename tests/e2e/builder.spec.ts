// =============================================================================
// Agent OS -- E2E Tests: Builder Page (2-Column Section-Card Editor)
// =============================================================================
// Tests for the agent builder with section cards (left) and live preview (right).
// The builder has 6 section cards: Identity, Purpose, Audience, Workflow,
// Memory Protocol, and Boundaries. The header has Try It, Export, Deploy,
// and Save buttons. The right panel shows a LivePreview with file tabs.
// =============================================================================

import { test, expect } from '@playwright/test'
import { createDeployableAgent, deleteAgent } from './helpers'

test.describe('Builder Page', () => {
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

  // ── Layout ────────────────────────────────────────────────────────

  test('builder page loads with 2-column layout', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Header with breadcrumb should be visible
    const backLink = page.getByText('Agents').first()
    await expect(backLink).toBeVisible()

    // Agent name should appear in the header
    await expect(page.getByText('TestBot').first()).toBeVisible()
  })

  test('all 6 section cards are visible', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Each section card has a title rendered as an h3
    const sections = ['Identity', 'Purpose', 'Audience', 'Workflow', 'Memory Protocol', 'Boundaries']

    for (const section of sections) {
      const heading = page.getByRole('heading', { name: section, level: 3 })
      await expect(heading).toBeVisible()
    }
  })

  test('each section card shows a status badge', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Section cards display status badges (Empty, Draft, or Done)
    // With the deployable config, most sections should be "Done"
    const doneBadges = page.getByText('Done')
    const doneCount = await doneBadges.count()
    expect(doneCount).toBeGreaterThanOrEqual(1)
  })

  // ── Header buttons ────────────────────────────────────────────────

  test('Try It button is visible in the header', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const tryItButton = page.getByRole('button', { name: /try it/i })
    await expect(tryItButton).toBeVisible()
  })

  test('Export button is visible in the header', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /export/i })
    await expect(exportButton).toBeVisible()
  })

  test('Save button is visible in the header', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const saveButton = page.getByRole('button', { name: /save/i })
    await expect(saveButton).toBeVisible()
  })

  test('Deploy button is visible when agent is not deployed', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const deployButton = page.getByRole('button', { name: /^deploy$/i })
    await expect(deployButton).toBeVisible()
  })

  // ── Identity card ─────────────────────────────────────────────────

  test('Identity card has Name, Emoji, Vibe, Tone, and Greeting fields', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Name field
    const nameInput = page.getByPlaceholder('Agent name')
    await expect(nameInput).toBeVisible()

    // Emoji field
    const emojiInput = page.getByPlaceholder('\uD83E\uDD16')
    await expect(emojiInput).toBeVisible()

    // Vibe field
    const vibeInput = page.getByPlaceholder('Friendly, helpful, solution-oriented')
    await expect(vibeInput).toBeVisible()

    // Tone pills (casual, professional, etc.)
    const casualPill = page.getByRole('button', { name: 'casual', exact: true })
    await expect(casualPill).toBeVisible()

    // Greeting field
    const greetingTextarea = page.getByPlaceholder(/Hey! I'm your agent/i)
    await expect(greetingTextarea).toBeVisible()
  })

  test('can fill in agent name in Identity card', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const nameInput = page.getByPlaceholder('Agent name')
    await nameInput.clear()
    await nameInput.fill('My New Agent')

    const value = await nameInput.inputValue()
    expect(value).toBe('My New Agent')
  })

  test('changing agent name updates the header breadcrumb', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const nameInput = page.getByPlaceholder('Agent name')
    await nameInput.clear()
    await nameInput.fill('RenamedAgent')

    // The header should reflect the new name
    await expect(page.locator('header').getByText('RenamedAgent')).toBeVisible()
  })

  test('selecting a tone pill updates the selected state', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Click the "professional" tone pill
    const professionalPill = page.getByRole('button', { name: 'professional', exact: true })
    await professionalPill.click()

    // The selected pill should have a highlighted style (bg-zinc-100 text-zinc-900)
    await expect(professionalPill).toHaveClass(/bg-zinc-100/)
  })

  // ── Purpose card ──────────────────────────────────────────────────

  test('Purpose card has Description and Key Tasks fields', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const descTextarea = page.getByPlaceholder('What does this agent do?')
    await expect(descTextarea).toBeVisible()

    const tasksInput = page.getByPlaceholder('Add a task and press Enter')
    await expect(tasksInput).toBeVisible()
  })

  test('can fill in the purpose description', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const descTextarea = page.getByPlaceholder('What does this agent do?')
    await descTextarea.clear()
    await descTextarea.fill('Helps customers resolve billing issues')

    const value = await descTextarea.inputValue()
    expect(value).toBe('Helps customers resolve billing issues')
  })

  // ── Audience card ─────────────────────────────────────────────────

  test('Audience card has Primary Audience and Scope fields', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const audienceInput = page.getByPlaceholder('Who will use this agent?')
    await expect(audienceInput).toBeVisible()

    // Scope pills
    const teamPill = page.getByRole('button', { name: 'Team' })
    await expect(teamPill).toBeVisible()
  })

  test('Audience card shows Optional label when empty', async ({ request, page }) => {
    // Create a fresh agent without the deployable config
    const createRes = await request.post('/api/agents', {
      data: { name: 'Bare Agent', description: 'test' },
    })
    const bare = await createRes.json()

    await page.goto(`/agents/${bare.id}`)
    await page.waitForLoadState('networkidle')

    const optional = page.getByText('Optional')
    const hasOptional = await optional.isVisible().catch(() => false)
    expect(hasOptional).toBe(true)

    // Clean up
    await request.delete(`/api/agents/${bare.id}`)
  })

  // ── Workflow card ─────────────────────────────────────────────────

  test('Workflow card has Add Capability and Add Trigger buttons', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const addCapability = page.getByRole('button', { name: /add capability/i })
    await expect(addCapability).toBeVisible()

    const addTrigger = page.getByRole('button', { name: /add trigger/i })
    await expect(addTrigger).toBeVisible()
  })

  // ── Memory card ───────────────────────────────────────────────────

  test('Memory card has strategy pills', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const conversational = page.getByRole('button', { name: 'Conversational' })
    await expect(conversational).toBeVisible()

    const taskBased = page.getByRole('button', { name: 'Task-based' })
    await expect(taskBased).toBeVisible()

    const minimal = page.getByRole('button', { name: 'Minimal' })
    await expect(minimal).toBeVisible()
  })

  // ── Boundaries card ───────────────────────────────────────────────

  test('Boundaries card has Behavioral Rules, Exclusions, and Defense fields', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const rulesInput = page.getByPlaceholder('Add a rule')
    await expect(rulesInput).toBeVisible()

    const exclusionsInput = page.getByPlaceholder('What should the agent NOT do?')
    await expect(exclusionsInput).toBeVisible()

    // Defense pills
    const strictPill = page.getByRole('button', { name: 'Strict' })
    await expect(strictPill).toBeVisible()
  })

  test('Boundaries card has collapsible resource limits', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const showLimits = page.getByText('Show resource limits')
    await expect(showLimits).toBeVisible()

    await showLimits.click()

    const maxTurnsInput = page.getByPlaceholder('25')
    await expect(maxTurnsInput).toBeVisible()
  })

  // ── Live Preview ──────────────────────────────────────────────────

  test('LivePreview shows agent.md tab by default', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // File tabs should be visible
    const agentMdTab = page.getByText('agent.md', { exact: true })
    await expect(agentMdTab).toBeVisible()

    const mcpJsonTab = page.getByText('.mcp.json', { exact: true })
    await expect(mcpJsonTab).toBeVisible()

    const settingsTab = page.getByText('settings.json', { exact: true })
    await expect(settingsTab).toBeVisible()
  })

  test('LivePreview updates when agent name is changed', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Change the agent name
    const nameInput = page.getByPlaceholder('Agent name')
    await nameInput.clear()
    await nameInput.fill('PreviewTestAgent')

    // The preview should contain the new name (rendered as an h1 in agent.md)
    await expect(page.getByText('PreviewTestAgent').last()).toBeVisible()
  })

  test('LivePreview can switch to .mcp.json tab', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const mcpJsonTab = page.getByText('.mcp.json', { exact: true })
    await mcpJsonTab.click()

    // The content should show MCP server configuration (JSON with mcpServers)
    await expect(page.getByText(/mcpServers/)).toBeVisible()
  })

  // ── Save flow ─────────────────────────────────────────────────────

  test('clicking Save triggers a save and button shows loading state', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    // Modify something to make the save meaningful
    const nameInput = page.getByPlaceholder('Agent name')
    await nameInput.clear()
    await nameInput.fill('SavedAgent')

    // Click Save
    const saveButton = page.getByRole('button', { name: /save/i })
    await saveButton.click()

    // Wait for the save to complete (button should remain visible)
    await expect(saveButton).toBeVisible({ timeout: 5000 })

    // Reload and verify the name persisted
    await page.reload()
    await page.waitForLoadState('networkidle')

    const reloadedName = page.getByPlaceholder('Agent name')
    await expect(reloadedName).toHaveValue('SavedAgent', { timeout: 5000 })
  })

  // ── Try It dialog ─────────────────────────────────────────────────

  test('clicking Try It opens the test chat interface', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const tryItButton = page.getByRole('button', { name: /try it/i })
    await tryItButton.click()

    // The test chat should open (full-screen replacement with an exit button)
    const exitButton = page.getByRole('button', { name: /exit|close|back/i }).first()
    await expect(exitButton).toBeVisible({ timeout: 5000 })
  })

  // ── Export dialog ─────────────────────────────────────────────────

  test('clicking Export opens the export dialog', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /export/i })
    await exportButton.click()

    // The export dialog should open with Claude Code instructions
    await expect(page.getByText(/claude code/i).first()).toBeVisible({ timeout: 5000 })
  })

  // ── Navigation ────────────────────────────────────────────────────

  test('back arrow navigates to agent list', async ({ page }) => {
    await page.goto(`/agents/${agentId}`)
    await page.waitForLoadState('networkidle')

    const backLink = page.getByText('Agents').first()
    await backLink.click()

    await page.waitForURL('/')
  })
})
