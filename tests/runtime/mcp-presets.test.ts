import { describe, it, expect } from 'vitest'
import { MCP_PRESETS, getPreset, listPresets } from '@/lib/runtime/mcp-presets'

describe('MCP_PRESETS', () => {
  it('has all 5 expected keys', () => {
    const keys = Object.keys(MCP_PRESETS)
    expect(keys).toHaveLength(5)
    expect(keys).toContain('filesystem')
    expect(keys).toContain('jiraCloud')
    expect(keys).toContain('browser')
    expect(keys).toContain('git')
    expect(keys).toContain('vercel')
  })

  it('each preset has required fields (name, transport, command)', () => {
    Object.entries(MCP_PRESETS).forEach(([key, preset]) => {
      expect(preset).toHaveProperty('name')
      expect(preset).toHaveProperty('transport')
      expect(preset).toHaveProperty('command')
      expect(typeof preset.name).toBe('string')
      expect(typeof preset.transport).toBe('string')
      expect(typeof preset.command).toBe('string')
    })
  })

  it('each preset name matches expected values', () => {
    expect(MCP_PRESETS.filesystem.name).toBe('filesystem')
    expect(MCP_PRESETS.jiraCloud.name).toBe('jira-cloud')
    expect(MCP_PRESETS.browser.name).toBe('browser')
    expect(MCP_PRESETS.git.name).toBe('git')
  })

  it('jira preset includes env with JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN', () => {
    expect(MCP_PRESETS.jiraCloud.env).toBeDefined()
    expect(MCP_PRESETS.jiraCloud.env).toHaveProperty('JIRA_URL')
    expect(MCP_PRESETS.jiraCloud.env).toHaveProperty('JIRA_EMAIL')
    expect(MCP_PRESETS.jiraCloud.env).toHaveProperty('JIRA_API_TOKEN')
  })

  it('browser preset has 30s timeout (highest), filesystem has 10s (lowest)', () => {
    expect(MCP_PRESETS.browser.sandbox?.maxExecutionMs).toBe(30000)
    expect(MCP_PRESETS.filesystem.sandbox?.maxExecutionMs).toBe(10000)
  })
})

describe('getPreset', () => {
  it('returns a deep copy (modifying returned value does not affect original)', () => {
    const preset = getPreset('filesystem')
    expect(preset).toBeDefined()

    if (preset) {
      // Modify the returned preset
      preset.name = 'modified-name'
      preset.args = ['modified', 'args']
      if (preset.sandbox) {
        preset.sandbox.maxExecutionMs = 99999
      }

      // Original should remain unchanged
      expect(MCP_PRESETS.filesystem.name).toBe('filesystem')
      expect(MCP_PRESETS.filesystem.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/tmp/agent-workspace',
      ])
      expect(MCP_PRESETS.filesystem.sandbox?.maxExecutionMs).toBe(10000)
    }
  })

  it('returns undefined for unknown key', () => {
    expect(getPreset('nonexistent')).toBeUndefined()
    expect(getPreset('unknown-preset')).toBeUndefined()
    expect(getPreset('')).toBeUndefined()
  })

  it('returns valid preset definitions for all known keys', () => {
    const filesystemPreset = getPreset('filesystem')
    expect(filesystemPreset).toBeDefined()
    expect(filesystemPreset?.name).toBe('filesystem')
    expect(filesystemPreset?.transport).toBe('stdio')
    expect(filesystemPreset?.command).toBe('npx')

    const jiraPreset = getPreset('jiraCloud')
    expect(jiraPreset).toBeDefined()
    expect(jiraPreset?.name).toBe('jira-cloud')

    const browserPreset = getPreset('browser')
    expect(browserPreset).toBeDefined()
    expect(browserPreset?.name).toBe('browser')

    const gitPreset = getPreset('git')
    expect(gitPreset).toBeDefined()
    expect(gitPreset?.name).toBe('git')
  })
})

describe('listPresets', () => {
  it('returns array with 5 entries', () => {
    const presets = listPresets()
    expect(Array.isArray(presets)).toBe(true)
    expect(presets).toHaveLength(5)
  })

  it('entries have key, name, description fields', () => {
    const presets = listPresets()
    presets.forEach((preset) => {
      expect(preset).toHaveProperty('key')
      expect(preset).toHaveProperty('name')
      expect(preset).toHaveProperty('description')
      expect(typeof preset.key).toBe('string')
      expect(typeof preset.name).toBe('string')
      expect(typeof preset.description).toBe('string')
      expect(preset.key.length).toBeGreaterThan(0)
      expect(preset.name.length).toBeGreaterThan(0)
      expect(preset.description.length).toBeGreaterThan(0)
    })
  })

  it('keys match MCP_PRESETS keys', () => {
    const presets = listPresets()
    const presetKeys = presets.map((p) => p.key)
    const mcpPresetKeys = Object.keys(MCP_PRESETS)

    expect(presetKeys.sort()).toEqual(mcpPresetKeys.sort())
  })
})
