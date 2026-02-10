// =============================================================================
// Agent OS -- Library Tests: generateSlug
// =============================================================================
// Tests for the slug generation utility.
// Source: src/lib/slug.ts
// =============================================================================

import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/slug'

describe('generateSlug', () => {
  // -------------------------------------------------------------------------
  // Basic conversion
  // -------------------------------------------------------------------------

  it('converts "My Agent" to "my-agent"', () => {
    expect(generateSlug('My Agent')).toBe('my-agent')
  })

  it('converts "UPPERCASE NAME" to "uppercase-name"', () => {
    expect(generateSlug('UPPERCASE NAME')).toBe('uppercase-name')
  })

  it('strips special characters: "special!@#chars" to "specialchars"', () => {
    expect(generateSlug('special!@#chars')).toBe('specialchars')
  })

  it('converts "Customer Support Agent" to "customer-support-agent"', () => {
    expect(generateSlug('Customer Support Agent')).toBe('customer-support-agent')
  })

  // -------------------------------------------------------------------------
  // Spec examples
  // -------------------------------------------------------------------------

  it('converts "Helix!!!" to "helix"', () => {
    expect(generateSlug('Helix!!!')).toBe('helix')
  })

  it('converts "My  Super  Agent  Name" to "my-super-agent-name"', () => {
    expect(generateSlug('My  Super  Agent  Name')).toBe('my-super-agent-name')
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles underscores by converting to hyphens', () => {
    expect(generateSlug('my_agent_name')).toBe('my-agent-name')
  })

  it('collapses consecutive hyphens', () => {
    expect(generateSlug('my---agent')).toBe('my-agent')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('-leading-and-trailing-')).toBe('leading-and-trailing')
  })

  it('handles mixed spaces and special characters', () => {
    expect(generateSlug('  Hello! World?  ')).toBe('hello-world')
  })

  it('handles a single word', () => {
    expect(generateSlug('Fixie')).toBe('fixie')
  })

  it('handles numbers', () => {
    expect(generateSlug('Agent 007')).toBe('agent-007')
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('handles only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('')
  })

  // -------------------------------------------------------------------------
  // Truncation
  // -------------------------------------------------------------------------

  it('truncates to 50 characters or fewer', () => {
    const longName =
      'This Is A Very Long Agent Name That Should Be Truncated To Fifty Characters'
    const result = generateSlug(longName)
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('preserves complete words when truncating (breaks at last hyphen)', () => {
    const longName =
      'This Is A Very Long Agent Name That Should Be Truncated Properly At Word Boundary'
    const result = generateSlug(longName)
    expect(result.length).toBeLessThanOrEqual(50)
    // Should not end with a hyphen
    expect(result).not.toMatch(/-$/)
  })

  it('returns valid slug characters only (a-z, 0-9, hyphens)', () => {
    const weirdInput = 'Agente Especial #1 -- El Rapido!'
    const result = generateSlug(weirdInput)
    expect(result).toMatch(/^[a-z0-9-]*$/)
  })

  // -------------------------------------------------------------------------
  // Agent name examples from the spec
  // -------------------------------------------------------------------------

  it('converts spec example agent names correctly', () => {
    expect(generateSlug('Fixie')).toBe('fixie')
    expect(generateSlug('Helix')).toBe('helix')
    expect(generateSlug('Sage')).toBe('sage')
    expect(generateSlug('Scout')).toBe('scout')
    expect(generateSlug('Support Assistant')).toBe('support-assistant')
    expect(generateSlug('Research Assistant')).toBe('research-assistant')
    expect(generateSlug('Sales Support Agent')).toBe('sales-support-agent')
  })
})
