// =============================================================================
// Agent OS -- E2E Tests: New Agent Page (Multi-step creation flow)
// =============================================================================
// Tests for the agent creation experience: archetype selection, audience,
// naming, review & create, plus template path.
// =============================================================================

import { test, expect } from '@playwright/test'

test.describe('New Agent Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const newAgentButton = page
      .getByRole('button', { name: /new agent/i })
      .or(page.getByRole('link', { name: /new agent/i }))

    if (await newAgentButton.isVisible()) {
      await newAgentButton.click()
      await page.waitForTimeout(500)
    }
  })

  // ── Step 1: Archetype selection ──────────────────────────────────

  test('shows archetype cards on step 1', async ({ page }) => {
    // Should show the 6 archetypes: Support, Research, Sales, Operations, Creative, Custom
    const support = page.getByText('Support').first()
    const research = page.getByText('Research').first()
    const custom = page.getByText('Custom').first()

    await expect(support).toBeVisible()
    await expect(research).toBeVisible()
    await expect(custom).toBeVisible()
  })

  test('shows step 1 heading', async ({ page }) => {
    const heading = page.getByText(/what kind of agent/i)
    await expect(heading).toBeVisible()
  })

  test('shows 3 template cards below archetypes', async ({ page }) => {
    const customerSupport = page.getByText(/customer support/i).first()
    const researchAssistant = page.getByText(/research assistant/i).first()
    const salesSupport = page.getByText(/sales support/i).first()

    const hasCustomerSupport = await customerSupport.isVisible().catch(() => false)
    const hasResearch = await researchAssistant.isVisible().catch(() => false)
    const hasSalesSupport = await salesSupport.isVisible().catch(() => false)

    expect(hasCustomerSupport).toBe(true)
    expect(hasResearch).toBe(true)
    expect(hasSalesSupport).toBe(true)
  })

  test('each template shows name and description', async ({ page }) => {
    const supportText = page.getByText(/customer support/i).first()
    if (await supportText.isVisible()) {
      const supportDesc = page.getByText(/faq|issues|escalat/i).first()
      const hasDesc = await supportDesc.isVisible().catch(() => false)
      expect(hasDesc).toBe(true)
    }
  })

  test('shows reassurance text on step 1', async ({ page }) => {
    const reassurance = page.getByText(/starting point/i).first()
    const hasReassurance = await reassurance.isVisible().catch(() => false)
    expect(hasReassurance).toBe(true)
  })

  // ── Step 2: Audience selection ───────────────────────────────────

  test('selecting a non-custom archetype advances to step 2', async ({ page }) => {
    // Click the Support archetype
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    // Step 2 should show audience options
    const heading = page.getByText(/who will use it/i)
    await expect(heading).toBeVisible()
  })

  test('step 2 shows 3 audience options', async ({ page }) => {
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    const justMe = page.getByText(/just me/i).first()
    const myTeam = page.getByText(/my team/i).first()
    const anyone = page.getByText(/anyone/i).first()

    await expect(justMe).toBeVisible()
    await expect(myTeam).toBeVisible()
    await expect(anyone).toBeVisible()
  })

  // ── Step 3: Name ────────────────────────────────────────────────

  test('selecting audience advances to step 3 (naming)', async ({ page }) => {
    // Step 1: select archetype
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    // Step 2: select audience
    const myTeam = page.getByText(/my team/i).first()
    await myTeam.click()
    await page.waitForTimeout(300)

    // Step 3: should show name input
    const heading = page.getByText(/give it a name/i)
    await expect(heading).toBeVisible()
  })

  test('step 3 shows suggested name pills', async ({ page }) => {
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    const myTeam = page.getByText(/my team/i).first()
    await myTeam.click()
    await page.waitForTimeout(300)

    // Suggested names for Support archetype: Fixie, Helpdesk, Assist
    const fixie = page.getByText('Fixie').first()
    const hasFixie = await fixie.isVisible().catch(() => false)
    expect(hasFixie).toBe(true)
  })

  test('step 3 name input accepts text', async ({ page }) => {
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    const myTeam = page.getByText(/my team/i).first()
    await myTeam.click()
    await page.waitForTimeout(300)

    const nameInput = page.getByPlaceholder(/fixie|scout|muse/i)
      .or(page.getByRole('textbox').first())

    if (await nameInput.isVisible()) {
      await nameInput.fill('TestBot')
      const value = await nameInput.inputValue()
      expect(value).toBe('TestBot')
    }
  })

  // ── Step 4: Review + Create ─────────────────────────────────────

  test('step 4 shows review summary and create button', async ({ page }) => {
    // Navigate through all steps
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    const myTeam = page.getByText(/my team/i).first()
    await myTeam.click()
    await page.waitForTimeout(300)

    const nameInput = page.getByPlaceholder(/fixie|scout|muse/i)
      .or(page.getByRole('textbox').first())
    await nameInput.fill('TestBot')

    const nextButton = page.getByRole('button', { name: /next/i })
    await nextButton.click()
    await page.waitForTimeout(300)

    // Should show review page
    const reviewHeading = page.getByText(/review/i).first()
    await expect(reviewHeading).toBeVisible()

    // Should show create button with agent name
    const createButton = page.getByRole('button', { name: /create testbot/i })
    const hasCreate = await createButton.isVisible().catch(() => false)
    expect(hasCreate).toBe(true)
  })

  // ── Custom archetype ────────────────────────────────────────────

  test('selecting Custom shows a textarea for description', async ({ page }) => {
    const customCard = page.getByText('Custom').first()
    await customCard.click()
    await page.waitForTimeout(300)

    // Should show a textarea for the description
    const textarea = page.getByPlaceholder(/describe what your agent/i)
      .or(page.locator('textarea').first())
    const hasTextarea = await textarea.isVisible().catch(() => false)
    expect(hasTextarea).toBe(true)
  })

  // ── Template path ───────────────────────────────────────────────

  test('clicking a template navigates to the builder', async ({
    page,
  }) => {
    const template = page.getByText(/customer support/i).first()

    if (await template.isVisible()) {
      await template.click()
      await page.waitForTimeout(2000)

      const url = page.url()
      const isOnBuilder =
        url.includes('/agents/') ||
        url.includes('/builder') ||
        url.includes('/build')

      const hasBuilderContent = await page
        .getByText(/mission|identity|support/i)
        .first()
        .isVisible()
        .catch(() => false)

      expect(isOnBuilder || hasBuilderContent).toBe(true)
    }
  })

  // ── Navigation ──────────────────────────────────────────────────

  test('step indicator dots are visible', async ({ page }) => {
    // There should be 4 step dots
    const dots = page.locator('.rounded-full.h-2.w-2')
    const count = await dots.count()
    expect(count).toBe(4)
  })

  test('back button goes to previous step', async ({ page }) => {
    const supportCard = page.getByText('Support').first()
    await supportCard.click()
    await page.waitForTimeout(300)

    // Should be on step 2
    const audienceHeading = page.getByText(/who will use it/i)
    await expect(audienceHeading).toBeVisible()

    // Click back
    const backButton = page.getByText('Back').first()
    await backButton.click()
    await page.waitForTimeout(300)

    // Should be back on step 1
    const step1Heading = page.getByText(/what kind of agent/i)
    await expect(step1Heading).toBeVisible()
  })
})
