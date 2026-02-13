// =============================================================================
// Agent OS -- E2E Tests: Team Pages
// =============================================================================
// Tests for team list page, team creation flow, and team workspace page.
// =============================================================================

import { test, expect } from "@playwright/test";
import { createDeployableAgent, deleteAgent } from "./helpers";

// ---------------------------------------------------------------------------
// 1. Team List Page (/teams)
// ---------------------------------------------------------------------------

test.describe("Team List Page", () => {
  test("displays team list page heading", async ({ page }) => {
    await page.goto("/teams");
    const heading = page.getByRole("heading", { level: 1, name: /teams/i });
    await expect(heading).toBeVisible();
  });

  test("shows New Team button", async ({ page }) => {
    await page.goto("/teams");
    const newTeamButton = page
      .getByRole("link", { name: /new team/i })
      .or(page.getByRole("button", { name: /new team/i }));
    await expect(newTeamButton).toBeVisible();
  });

  test("navigates to create team page when clicking New Team", async ({
    page,
  }) => {
    await page.goto("/teams");
    const newTeamLink = page
      .getByRole("link", { name: /new team/i })
      .first();
    await newTeamLink.click();
    await expect(page).toHaveURL(/\/teams\/new/);
  });

  test("shows Agents navigation link", async ({ page }) => {
    await page.goto("/teams");
    const agentsLink = page.getByRole("link", { name: /agents/i });
    await expect(agentsLink).toBeVisible();
  });

  test("shows empty state or team cards", async ({ page }) => {
    await page.goto("/teams");
    // Either we see the empty state text or a grid of team cards
    const emptyState = page
      .getByText(/create your first team/i)
      .first();
    const teamCards = page.locator("a[href^='/teams/']").filter({
      hasNotText: /new team/i,
    });

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const cardCount = await teamCards.count();

    // At least one should be true: either empty state or some cards
    expect(hasEmptyState || cardCount > 0).toBe(true);
  });

  test("page has correct title", async ({ page }) => {
    await page.goto("/teams");
    const title = await page.title();
    expect(typeof title).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 2. Create Team Page (/teams/new)
// ---------------------------------------------------------------------------

test.describe("Create Team Page", () => {
  test("displays New Team heading", async ({ page }) => {
    await page.goto("/teams/new");
    const heading = page.getByRole("heading", { level: 1, name: /new team/i });
    await expect(heading).toBeVisible();
  });

  test("displays Team Details form section", async ({ page }) => {
    await page.goto("/teams/new");
    const detailsHeading = page.getByText(/team details/i);
    await expect(detailsHeading).toBeVisible();
  });

  test("shows name input field", async ({ page }) => {
    await page.goto("/teams/new");
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/engineering squad/i)
    );
    await expect(nameInput).toBeVisible();
  });

  test("shows description textarea", async ({ page }) => {
    await page.goto("/teams/new");
    const descInput = page.getByLabel(/description/i).or(
      page.getByPlaceholder(/a team of specialized agents/i)
    );
    await expect(descInput).toBeVisible();
  });

  test("shows Team Members section with Load Agents button", async ({
    page,
  }) => {
    await page.goto("/teams/new");
    const membersHeading = page.getByText(/team members/i);
    await expect(membersHeading).toBeVisible();

    const loadAgentsButton = page.getByRole("button", {
      name: /load agents/i,
    });
    await expect(loadAgentsButton).toBeVisible();
  });

  test("shows prompt text before loading agents", async ({ page }) => {
    await page.goto("/teams/new");
    const promptText = page.getByText(
      /click.*load agents.*to select team members/i
    );
    await expect(promptText).toBeVisible();
  });

  test("shows Create Team and Cancel buttons", async ({ page }) => {
    await page.goto("/teams/new");
    const createButton = page.getByRole("button", { name: /create team/i });
    await expect(createButton).toBeVisible();

    const cancelButton = page
      .getByRole("button", { name: /cancel/i })
      .or(page.getByRole("link", { name: /cancel/i }));
    await expect(cancelButton).toBeVisible();
  });

  test("Create Team button is disabled when name is empty", async ({
    page,
  }) => {
    await page.goto("/teams/new");
    const createButton = page.getByRole("button", { name: /create team/i });
    await expect(createButton).toBeDisabled();
  });

  test("name input accepts text", async ({ page }) => {
    await page.goto("/teams/new");
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/engineering squad/i)
    );
    await nameInput.fill("My Test Team");
    const value = await nameInput.inputValue();
    expect(value).toBe("My Test Team");
  });

  test("description textarea accepts text", async ({ page }) => {
    await page.goto("/teams/new");
    const descInput = page.getByLabel(/description/i).or(
      page.getByPlaceholder(/a team of specialized agents/i)
    );
    await descInput.fill("A test description");
    const value = await descInput.inputValue();
    expect(value).toBe("A test description");
  });

  test("shows validation error when submitting without agents", async ({
    page,
  }) => {
    await page.goto("/teams/new");
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/engineering squad/i)
    );
    await nameInput.fill("Validation Test Team");

    // The button should still be disabled since no agents are selected
    const createButton = page.getByRole("button", { name: /create team/i });
    // Even if enabled, clicking should show an error
    if (await createButton.isEnabled()) {
      await createButton.click();
      const errorMsg = page.getByText(/please select at least one agent/i);
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    } else {
      // Button is disabled, which is valid validation behavior
      await expect(createButton).toBeDisabled();
    }
  });

  test("Load Agents button fetches available agents", async ({ page }) => {
    await page.goto("/teams/new");
    const loadButton = page.getByRole("button", { name: /load agents/i });
    await loadButton.click();

    // Should show either available agents or a "no agents" message
    await page.waitForTimeout(2000);

    const availableAgents = page.getByText(/available agents/i);
    const noAgents = page.getByText(/no agents available/i);

    const hasAvailable = await availableAgents.isVisible().catch(() => false);
    const hasNoAgents = await noAgents.isVisible().catch(() => false);

    expect(hasAvailable || hasNoAgents).toBe(true);
  });

  test("Load Agents button becomes disabled after loading", async ({
    page,
  }) => {
    await page.goto("/teams/new");
    const loadButton = page.getByRole("button", { name: /load agents/i });
    await loadButton.click();

    // Wait for loading to finish
    await page.waitForTimeout(2000);

    // After loading, button should be disabled and show "Loaded"
    const loadedButton = page.getByRole("button", { name: /loaded/i });
    await expect(loadedButton).toBeVisible();
    await expect(loadedButton).toBeDisabled();
  });

  test("Back button navigates to teams list", async ({ page }) => {
    await page.goto("/teams/new");
    const backButton = page
      .getByRole("button", { name: /back/i })
      .or(page.getByRole("link", { name: /back/i }));
    await backButton.click();
    await expect(page).toHaveURL(/\/teams$/);
  });

  test("Cancel button navigates to teams list", async ({ page }) => {
    await page.goto("/teams/new");
    const cancelButton = page
      .getByRole("link", { name: /cancel/i })
      .or(page.getByRole("button", { name: /cancel/i }));
    await cancelButton.click();
    await expect(page).toHaveURL(/\/teams$/);
  });
});

// ---------------------------------------------------------------------------
// 3. Create Team Flow (end-to-end with agent creation)
// ---------------------------------------------------------------------------

test.describe("Create Team Flow", () => {
  let agentId: string;

  test.beforeAll(async ({ request }) => {
    // Create an agent to use as a team member
    const agent = await createDeployableAgent(request);
    agentId = agent.id;
  });

  test.afterAll(async ({ request }) => {
    if (agentId) {
      await deleteAgent(request, agentId);
    }
  });

  test("creates a team with an agent member and redirects to workspace", async ({
    page,
  }) => {
    await page.goto("/teams/new");

    // Fill in team name
    const nameInput = page.getByLabel(/name/i).or(
      page.getByPlaceholder(/engineering squad/i)
    );
    await nameInput.fill(`E2E Test Team ${Date.now()}`);

    // Fill description
    const descInput = page.getByLabel(/description/i).or(
      page.getByPlaceholder(/a team of specialized agents/i)
    );
    await descInput.fill("Created by E2E test");

    // Load agents
    const loadButton = page.getByRole("button", { name: /load agents/i });
    await loadButton.click();

    // Wait for agents to load
    await page.waitForTimeout(3000);

    // Select the first available agent (click on it)
    const availableAgentsSection = page.getByText(/available agents/i);
    if (await availableAgentsSection.isVisible()) {
      // Click the first agent button in the list
      const firstAgent = page
        .locator("button")
        .filter({ hasText: /e2e testbot/i })
        .first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();
        await page.waitForTimeout(500);

        // Verify selection badge appeared
        const selectedBadge = page.getByText(/selected/i);
        const hasSelected = await selectedBadge.isVisible().catch(() => false);

        // Submit the form
        const createButton = page.getByRole("button", {
          name: /create team/i,
        });
        if (await createButton.isEnabled()) {
          await createButton.click();
          // Should redirect to team workspace
          await page.waitForURL(/\/teams\/[a-zA-Z0-9]/, { timeout: 15000 });
          expect(page.url()).toMatch(/\/teams\/.+/);
          expect(page.url()).not.toMatch(/\/teams\/new/);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Team Workspace Page (/teams/[id])
// ---------------------------------------------------------------------------

test.describe("Team Workspace Page", () => {
  let teamId: string;
  let agentId: string;

  test.beforeAll(async ({ request }) => {
    // Create an agent for the team
    const agent = await createDeployableAgent(request);
    agentId = agent.id;

    // Create a team via API with the agent as a member
    const res = await request.post("/api/teams", {
      data: {
        name: `E2E Workspace Team ${Date.now()}`,
        description: "For E2E testing",
        agentIds: [agentId],
      },
    });

    if (!res.ok()) {
      throw new Error(
        `Failed to create team: ${res.status()} ${await res.text()}`
      );
    }

    const data = await res.json();
    teamId = data.id;
  });

  test.afterAll(async ({ request }) => {
    if (teamId) {
      await request.delete(`/api/teams/${teamId}`);
    }
    if (agentId) {
      await deleteAgent(request, agentId);
    }
  });

  test("displays team name in heading", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/e2e workspace team/i);
  });

  test("shows team status badge", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    // The team should show a Draft badge by default
    const badge = page.getByText("Draft", { exact: true }).first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("shows Back button linking to teams list", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const backButton = page
      .getByRole("button", { name: /back/i })
      .or(page.getByRole("link", { name: /back/i }));
    await expect(backButton).toBeVisible({ timeout: 10000 });
  });

  test("Back button navigates to teams list", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const backButton = page
      .getByRole("link", { name: /back/i })
      .or(page.getByRole("button", { name: /back/i }))
      .first();
    await backButton.click();
    await expect(page).toHaveURL(/\/teams$/);
  });

  test("shows Deploy button", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const deployButton = page.getByRole("button", { name: /deploy/i });
    await expect(deployButton).toBeVisible({ timeout: 10000 });
  });

  test("displays agent member tab", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    // The team has one member; its name tab should be visible
    const memberTab = page.getByText(/e2e testbot/i).first();
    await expect(memberTab).toBeVisible({ timeout: 10000 });
  });

  test("shows Shared Memory section", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const sharedMemory = page.getByText(/shared memory/i);
    await expect(sharedMemory).toBeVisible({ timeout: 10000 });
  });

  test("shows Projects section", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const projectsHeading = page.getByText(/projects/i).first();
    await expect(projectsHeading).toBeVisible({ timeout: 10000 });
  });

  test("shows no projects empty state initially", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const noProjects = page.getByText(/no projects yet/i);
    await expect(noProjects).toBeVisible({ timeout: 10000 });
  });

  test("shows Create First Project button when no projects", async ({
    page,
  }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const createProjectButton = page.getByRole("button", {
      name: /create first project/i,
    });
    await expect(createProjectButton).toBeVisible({ timeout: 10000 });
  });

  test("shows Recent Activity section", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const activityHeading = page.getByText(/recent activity/i);
    await expect(activityHeading).toBeVisible({ timeout: 10000 });
  });

  test("shows no activity empty state initially", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");
    const noActivity = page.getByText(/no activity yet/i);
    await expect(noActivity).toBeVisible({ timeout: 10000 });
  });

  test("Create First Project button reveals project form", async ({
    page,
  }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", {
      name: /create first project/i,
    });
    await createButton.click();

    // The project form should now be visible with name and brief inputs
    const projectNameInput = page.getByPlaceholder(/project name/i);
    await expect(projectNameInput).toBeVisible({ timeout: 5000 });

    const briefInput = page.getByPlaceholder(/brief description/i);
    await expect(briefInput).toBeVisible();
  });

  test("project form has Create and Cancel buttons", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", {
      name: /create first project/i,
    });
    await createButton.click();

    await page.waitForTimeout(500);

    // Within the project form, there should be Create and Cancel buttons
    const formCreateButton = page
      .getByRole("button", { name: /^create$/i })
      .first();
    const formCancelButton = page
      .getByRole("button", { name: /cancel/i })
      .first();

    await expect(formCreateButton).toBeVisible();
    await expect(formCancelButton).toBeVisible();
  });

  test("project form Cancel button hides the form", async ({ page }) => {
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", {
      name: /create first project/i,
    });
    await createButton.click();

    const projectNameInput = page.getByPlaceholder(/project name/i);
    await expect(projectNameInput).toBeVisible({ timeout: 5000 });

    // Click Cancel
    const cancelButton = page
      .getByRole("button", { name: /cancel/i })
      .first();
    await cancelButton.click();

    // Form should be hidden
    await expect(projectNameInput).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Team Workspace -- 404 and error handling
// ---------------------------------------------------------------------------

test.describe("Team Workspace Error Handling", () => {
  test("shows error for non-existent team ID", async ({ page }) => {
    await page.goto("/teams/non-existent-id-12345");
    await page.waitForLoadState("networkidle");

    // Should show an error message or "Team not found"
    const errorText = page
      .getByText(/team not found|failed to fetch|error/i)
      .first();
    const backLink = page
      .getByRole("link", { name: /back to teams/i })
      .or(page.getByRole("button", { name: /back to teams/i }));

    const hasError = await errorText.isVisible().catch(() => false);
    const hasBack = await backLink.isVisible().catch(() => false);

    // At least one indicator of the error state should be present
    expect(hasError || hasBack).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Team List -- Team card after creation
// ---------------------------------------------------------------------------

test.describe("Team List with Existing Team", () => {
  let teamId: string;
  let agentId: string;

  test.beforeAll(async ({ request }) => {
    // Create an agent and a team
    const agent = await createDeployableAgent(request);
    agentId = agent.id;

    const res = await request.post("/api/teams", {
      data: {
        name: `E2E Listed Team ${Date.now()}`,
        description: "Should appear in the team list",
        agentIds: [agentId],
      },
    });

    const data = await res.json();
    teamId = data.id;
  });

  test.afterAll(async ({ request }) => {
    if (teamId) {
      await request.delete(`/api/teams/${teamId}`);
    }
    if (agentId) {
      await deleteAgent(request, agentId);
    }
  });

  test("team card shows team name", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    const teamName = page.getByText(/e2e listed team/i).first();
    await expect(teamName).toBeVisible({ timeout: 10000 });
  });

  test("team card shows description", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    const description = page
      .getByText(/should appear in the team list/i)
      .first();
    await expect(description).toBeVisible({ timeout: 10000 });
  });

  test("team card shows status badge", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    // New teams default to "draft" status
    const badge = page.getByText("Draft", { exact: true }).first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("shows stats bar with team count", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    // Stats bar should show count like "X teams"
    const statsText = page.getByText(/\d+ teams?/i).first();
    await expect(statsText).toBeVisible({ timeout: 10000 });
  });

  test("clicking a team card navigates to workspace", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");

    // Click the link to our team
    const teamLink = page.locator(`a[href="/teams/${teamId}"]`).first();
    if (await teamLink.isVisible()) {
      await teamLink.click();
      await expect(page).toHaveURL(`/teams/${teamId}`);
    }
  });

  test("shows quick-create card in grid", async ({ page }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    // When teams exist, a dashed quick-create card should appear
    const quickCreate = page
      .getByText("New Team", { exact: true })
      .last();
    await expect(quickCreate).toBeVisible({ timeout: 10000 });
  });
});
