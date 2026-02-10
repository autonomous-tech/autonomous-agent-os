// =============================================================================
// Agent OS -- Library Tests: Export (ZIP Generation)
// =============================================================================
// Tests for the ZIP generation and validation functions in src/lib/export.ts.
// Spec reference: Section 7 -- Agent Output Format
// =============================================================================

import { describe, it, expect } from 'vitest'
import { validateAgent, generateZip } from '@/lib/export'
import type { AgentConfig, StageData } from '@/lib/types'
import { sampleAgentConfig, sampleStageData } from '../helpers/fixtures'
import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Helper to create a mock AgentProject row for generateZip
// ---------------------------------------------------------------------------

function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clx_test_export',
    name: 'Fixie',
    slug: 'fixie',
    description: 'Customer support agent for SaaS product',
    status: 'building',
    config: JSON.stringify(sampleAgentConfig),
    stages: JSON.stringify(sampleStageData),
    conversations: JSON.stringify({
      mission: [],
      identity: [],
      capabilities: [],
      memory: [],
      triggers: [],
      guardrails: [],
    }),
    templateId: null,
    createdAt: new Date('2026-02-10T12:00:00.000Z'),
    updatedAt: new Date('2026-02-10T12:00:00.000Z'),
    exportedAt: null,
    ...overrides,
  } as Parameters<typeof generateZip>[0]
}

// ===========================================================================
// validateAgent (from @/lib/export -- takes config + stages)
// ===========================================================================

describe('validateAgent (export module)', () => {
  it('returns valid=true for a complete config with all stages', () => {
    const result = validateAgent(sampleAgentConfig, sampleStageData)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns structural error when identity name is missing', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      identity: { ...sampleAgentConfig.identity, name: undefined },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('name')
      )
    ).toBe(true)
  })

  it('returns structural error when mission description is missing', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, description: undefined },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('description')
      )
    ).toBe(true)
  })

  it('returns structural error when no tasks are defined', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, tasks: [] },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.level === 'structural' && e.message.includes('tasks')
      )
    ).toBe(true)
  })

  it('returns completeness warning when no exclusions are defined', () => {
    const config: AgentConfig = {
      ...sampleAgentConfig,
      mission: { ...sampleAgentConfig.mission, exclusions: [] },
    }
    const result = validateAgent(config, sampleStageData)
    expect(result.valid).toBe(true) // Should not block
    expect(
      result.warnings.some(
        (w) => w.level === 'completeness' && w.message.includes('exclusion')
      )
    ).toBe(true)
  })

  it('returns consistency warning for incomplete stages', () => {
    const incompleteStages: StageData = {
      mission: { status: 'approved', data: {} },
      identity: { status: 'approved', data: {} },
      capabilities: { status: 'incomplete', data: {} },
      memory: { status: 'incomplete', data: {} },
      triggers: { status: 'incomplete', data: {} },
      guardrails: { status: 'incomplete', data: {} },
    }
    const result = validateAgent(sampleAgentConfig, incompleteStages)
    expect(
      result.warnings.some(
        (w) =>
          w.level === 'consistency' &&
          w.message.includes('not yet configured')
      )
    ).toBe(true)
  })
})

// ===========================================================================
// generateZip
// ===========================================================================

describe('generateZip', () => {
  it('generates a non-empty buffer', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    expect(buffer).toBeTruthy()
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('generates a valid ZIP file (starts with PK signature)', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    expect(buffer[0]).toBe(0x50) // P
    expect(buffer[1]).toBe(0x4b) // K
  })

  it('contains all 13 expected files', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)
    const fileNames = Object.keys(zip.files).filter((f) => !zip.files[f].dir)

    const expectedFiles = [
      'agent.yaml',
      'agent.md',
      'personality/identity.md',
      'personality/soul.md',
      'capabilities/tools.md',
      'capabilities/skills.yaml',
      'memory/strategy.md',
      'memory/bootstrap.md',
      'operations/triggers.yaml',
      'operations/guardrails.md',
      'user.md',
      'README.md',
      '.agent-os-meta.json',
    ]

    for (const expected of expectedFiles) {
      const found = fileNames.some(
        (f) => f === expected || f.endsWith(`/${expected}`)
      )
      expect(found).toBe(true)
    }
  })

  it('nests files under agent-{slug}/ directory', async () => {
    const project = createMockProject({ slug: 'fixie' })
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)
    const fileNames = Object.keys(zip.files)

    const hasPrefix = fileNames.some((f) => f.startsWith('agent-fixie/'))
    expect(hasPrefix).toBe(true)
  })
})

// ===========================================================================
// agent.yaml Content
// ===========================================================================

describe('agent.yaml content', () => {
  it('contains the agent name', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const yamlFile = Object.keys(zip.files).find((f) =>
      f.endsWith('/agent.yaml')
    )!
    const content = await zip.files[yamlFile].async('string')
    expect(content).toContain('Fixie')
  })

  it('contains mission, identity, capabilities, memory, triggers, guardrails sections', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const yamlFile = Object.keys(zip.files).find((f) =>
      f.endsWith('/agent.yaml')
    )!
    const content = await zip.files[yamlFile].async('string')

    expect(content).toContain('identity:')
    expect(content).toContain('mission:')
    expect(content).toContain('capabilities:')
    expect(content).toContain('memory:')
    expect(content).toContain('triggers:')
    expect(content).toContain('guardrails:')
  })
})

// ===========================================================================
// .agent-os-meta.json Content
// ===========================================================================

describe('.agent-os-meta.json content', () => {
  it('contains agentOsVersion, generatedAt, stages, and exportFormat', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const metaFile = Object.keys(zip.files).find((f) =>
      f.endsWith('/.agent-os-meta.json')
    )!
    const content = await zip.files[metaFile].async('string')
    const meta = JSON.parse(content) as Record<string, unknown>

    expect(meta).toHaveProperty('agentOsVersion', '1.0.0')
    expect(meta).toHaveProperty('generatedAt')
    expect(typeof meta.generatedAt).toBe('string')
    expect(meta).toHaveProperty('exportFormat', 'zip')
  })

  it('contains stage statuses for all 6 stages', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const metaFile = Object.keys(zip.files).find((f) =>
      f.endsWith('/.agent-os-meta.json')
    )!
    const content = await zip.files[metaFile].async('string')
    const meta = JSON.parse(content) as Record<string, unknown>
    const stages = meta.stages as Record<string, unknown>

    expect(stages).toHaveProperty('mission')
    expect(stages).toHaveProperty('identity')
    expect(stages).toHaveProperty('capabilities')
    expect(stages).toHaveProperty('memory')
    expect(stages).toHaveProperty('triggers')
    expect(stages).toHaveProperty('guardrails')
  })

  it('includes template reference (null when not from template)', async () => {
    const project = createMockProject({ templateId: null })
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const metaFile = Object.keys(zip.files).find((f) =>
      f.endsWith('/.agent-os-meta.json')
    )!
    const content = await zip.files[metaFile].async('string')
    const meta = JSON.parse(content) as Record<string, unknown>

    expect(meta).toHaveProperty('template', null)
  })
})

// ===========================================================================
// Personality Files
// ===========================================================================

describe('Personality files', () => {
  it('identity.md contains the agent name and tone', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const file = Object.keys(zip.files).find((f) =>
      f.endsWith('/personality/identity.md')
    )!
    const content = await zip.files[file].async('string')

    expect(content).toContain('Fixie')
    expect(content).toContain('casual-professional')
  })

  it('soul.md contains persona and guardrails', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const file = Object.keys(zip.files).find((f) =>
      f.endsWith('/personality/soul.md')
    )!
    const content = await zip.files[file].async('string')

    expect(content).toContain('Fixie')
    expect(content).toContain('Persona')
    expect(content).toContain('Safety Guardrails')
    expect(content).toContain('Prompt injection defense')
  })
})

// ===========================================================================
// README.md
// ===========================================================================

describe('README.md', () => {
  it('contains the agent name and file overview', async () => {
    const project = createMockProject()
    const buffer = await generateZip(project)
    const zip = await JSZip.loadAsync(buffer)

    const file = Object.keys(zip.files).find((f) =>
      f.endsWith('/README.md')
    )!
    const content = await zip.files[file].async('string')

    expect(content).toContain('Fixie')
    expect(content).toContain('agent.yaml')
    expect(content).toContain('agent.md')
    expect(content).toContain('Quick Start')
  })
})
