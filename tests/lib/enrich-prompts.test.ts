import { describe, it, expect } from 'vitest'
import { buildEnrichmentPrompt } from '@/lib/prompts/enrich'
import { sampleAgentConfig } from '../helpers/fixtures'

describe('buildEnrichmentPrompt', () => {
  const sectionTypes = ['identity', 'purpose', 'audience', 'workflow', 'memory', 'boundaries']

  it.each(sectionTypes)('returns a string for section type "%s"', (section) => {
    const sectionData = { description: 'test data' }
    const result = buildEnrichmentPrompt(section, sectionData, sampleAgentConfig)

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a string for an unknown section type', () => {
    const result = buildEnrichmentPrompt('unknown_section', { foo: 'bar' }, sampleAgentConfig)

    expect(typeof result).toBe('string')
    // Should fall back to generic context
    expect(result).toContain('reviewing an AI agent configuration section')
  })

  it('includes section data in the prompt', () => {
    const sectionData = {
      name: 'Fixie',
      vibe: 'Friendly and helpful',
      tone: 'casual-professional',
    }

    const result = buildEnrichmentPrompt('identity', sectionData, sampleAgentConfig)

    expect(result).toContain('Fixie')
    expect(result).toContain('Friendly and helpful')
    expect(result).toContain('casual-professional')
  })

  it('includes full config for cross-reference', () => {
    const sectionData = { description: 'test' }

    const result = buildEnrichmentPrompt('purpose', sectionData, sampleAgentConfig)

    // The full config should be serialized into the prompt
    expect(result).toContain('Full agent config')
    expect(result).toContain('cross-reference')
    // Check that parts of the full config appear in the prompt
    expect(result).toContain(sampleAgentConfig.identity!.name!)
    expect(result).toContain(sampleAgentConfig.mission!.description!)
  })

  it('includes section-specific context for identity', () => {
    const result = buildEnrichmentPrompt('identity', { name: 'Test' }, sampleAgentConfig)

    expect(result).toContain('Identity section')
    expect(result).toContain('name clarity')
    expect(result).toContain('personality')
    expect(result).toContain('tone')
    expect(result).toContain('greeting')
  })

  it('includes section-specific context for purpose', () => {
    const result = buildEnrichmentPrompt('purpose', { description: 'Test' }, sampleAgentConfig)

    expect(result).toContain('Purpose section')
    expect(result).toContain('description clarity')
    expect(result).toContain('task completeness')
    expect(result).toContain('task specificity')
  })

  it('includes section-specific context for audience', () => {
    const result = buildEnrichmentPrompt('audience', { primary: 'Developers' }, sampleAgentConfig)

    expect(result).toContain('Audience section')
    expect(result).toContain('audience specificity')
    expect(result).toContain('scope')
  })

  it('includes section-specific context for workflow', () => {
    const result = buildEnrichmentPrompt('workflow', { tools: [] }, sampleAgentConfig)

    expect(result).toContain('Workflow section')
    expect(result).toContain('capability completeness')
    expect(result).toContain('trigger')
  })

  it('includes section-specific context for memory', () => {
    const result = buildEnrichmentPrompt('memory', { strategy: 'conversational' }, sampleAgentConfig)

    expect(result).toContain('Memory Protocol section')
    expect(result).toContain('strategy')
    expect(result).toContain('what-to-remember')
  })

  it('includes section-specific context for boundaries', () => {
    const result = buildEnrichmentPrompt('boundaries', { behavioral: [] }, sampleAgentConfig)

    expect(result).toContain('Boundaries section')
    expect(result).toContain('rule clarity')
    expect(result).toContain('contradiction detection')
  })

  it('includes JSON structure instructions in the prompt', () => {
    const result = buildEnrichmentPrompt('purpose', { description: 'test' }, sampleAgentConfig)

    expect(result).toContain('suggestions')
    expect(result).toContain('ideas')
    expect(result).toContain('questions')
    expect(result).toContain('Return ONLY valid JSON')
  })

  it('serializes complex section data correctly', () => {
    const sectionData = {
      tools: [
        { id: 'search', name: 'Web Search', access: 'read-only', description: 'Search the web' },
        { id: 'write', name: 'File Writer', access: 'write', description: 'Write files' },
      ],
      triggers: [
        { type: 'message', description: 'On user message' },
      ],
    }

    const result = buildEnrichmentPrompt('workflow', sectionData, sampleAgentConfig)

    expect(result).toContain('Web Search')
    expect(result).toContain('File Writer')
    expect(result).toContain('On user message')
  })

  it('handles empty section data', () => {
    const result = buildEnrichmentPrompt('purpose', {}, sampleAgentConfig)

    expect(typeof result).toBe('string')
    expect(result).toContain('Current section data')
    expect(result).toContain('{}')
  })

  it('handles empty config', () => {
    const result = buildEnrichmentPrompt('purpose', { description: 'test' }, {})

    expect(typeof result).toBe('string')
    expect(result).toContain('Full agent config')
  })
})
