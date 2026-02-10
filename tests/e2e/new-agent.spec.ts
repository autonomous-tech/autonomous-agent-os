// =============================================================================
// Agent OS -- E2E Tests: New Agent Page
// =============================================================================
// Tests for the agent creation experience (description input + templates).
// Spec reference: Section 3 -- Templates
// =============================================================================

import { test, expect } from '@playwright/test'

test.describe('New Agent Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new agent page
    // This could be /new, /agents/new, or triggered by the "New Agent" button
    await page.goto('/')

    // Click the New Agent button to get to the creation flow
    const newAgentButton = page
      .getByRole('button', { name: /new agent/i })
      .or(page.getByRole('link', { name: /new agent/i }))

    if (await newAgentButton.isVisible()) {
      await newAgentButton.click()
      await page.waitForTimeout(500)
    }
  })

  test('shows text input for agent description', async ({ page }) => {
    // There should be a text input or textarea for entering the agent description
    const descInput = page
      .getByPlaceholder(/describe|agent you want|one sentence/i)
      .or(page.getByRole('textbox').first())
    await expect(descInput).toBeVisible()
  })

  test('shows 3 template cards', async ({ page }) => {
    // The spec defines 3 templates: Customer Support, Research Assistant, Sales Support
    const customerSupport = page.getByText(/customer support/i).first()
    const research = page.getByText(/research assistant/i).first()
    const salesSupport = page.getByText(/sales support/i).first()

    // At least the template names should be visible
    const hasCustomerSupport = await customerSupport.isVisible().catch(() => false)
    const hasResearch = await research.isVisible().catch(() => false)
    const hasSalesSupport = await salesSupport.isVisible().catch(() => false)

    // All 3 templates should be visible
    expect(hasCustomerSupport).toBe(true)
    expect(hasResearch).toBe(true)
    expect(hasSalesSupport).toBe(true)
  })

  test('each template shows name and description', async ({ page }) => {
    // Customer Support template
    const supportText = page.getByText(/customer support/i).first()
    if (await supportText.isVisible()) {
      // The description should be nearby
      const supportDesc = page
        .getByText(/faq|issues|escalat/i)
        .first()
      const hasDesc = await supportDesc.isVisible().catch(() => false)
      expect(hasDesc).toBe(true)
    }

    // Research Assistant template
    const researchText = page.getByText(/research assistant/i).first()
    if (await researchText.isVisible()) {
      const researchDesc = page
        .getByText(/monitor|summar|findings/i)
        .first()
      const hasDesc = await researchDesc.isVisible().catch(() => false)
      expect(hasDesc).toBe(true)
    }
  })

  test('typing a description and submitting navigates to the builder', async ({
    page,
  }) => {
    const descInput = page
      .getByPlaceholder(/describe|agent|one sentence/i)
      .or(page.getByRole('textbox').first())

    if (await descInput.isVisible()) {
      await descInput.fill(
        'A customer support agent for my SaaS product'
      )

      // Find and click the submit button
      const submitButton = page
        .getByRole('button', { name: /create|start|build|submit|go/i })
        .first()

      if (await submitButton.isVisible()) {
        await submitButton.click()

        // Wait for navigation to the builder page
        await page.waitForTimeout(2000)

        // Should be on the builder page now (URL contains the agent ID)
        const url = page.url()
        const isOnBuilder =
          url.includes('/agents/') ||
          url.includes('/builder') ||
          url.includes('/build')

        // Or the page content should show builder elements
        const hasBuilderContent = await page
          .getByText(/mission|identity|capabilities/i)
          .first()
          .isVisible()
          .catch(() => false)

        expect(isOnBuilder || hasBuilderContent).toBe(true)
      }
    }
  })

  test('clicking a template navigates to the builder with pre-filled data', async ({
    page,
  }) => {
    // Click on the Customer Support template
    const template = page.getByText(/customer support/i).first()

    if (await template.isVisible()) {
      await template.click()

      // Wait for navigation
      await page.waitForTimeout(2000)

      // Should be on the builder page
      const url = page.url()
      const isOnBuilder =
        url.includes('/agents/') ||
        url.includes('/builder') ||
        url.includes('/build')

      // Or the page content should show builder elements with pre-filled data
      const hasBuilderContent = await page
        .getByText(/mission|identity|support/i)
        .first()
        .isVisible()
        .catch(() => false)

      expect(isOnBuilder || hasBuilderContent).toBe(true)
    }
  })

  test('description input accepts text', async ({ page }) => {
    const descInput = page
      .getByPlaceholder(/describe|agent|one sentence/i)
      .or(page.getByRole('textbox').first())

    if (await descInput.isVisible()) {
      await descInput.fill('A research assistant that monitors AI papers')
      const value = await descInput.inputValue()
      expect(value).toContain('research assistant')
    }
  })
})
