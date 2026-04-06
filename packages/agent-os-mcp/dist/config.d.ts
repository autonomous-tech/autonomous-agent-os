/**
 * MCP server configuration — CLI args, env vars, and agent resolution.
 */
export interface McpConfig {
    /** Agent OS server URL (e.g. http://localhost:3000) */
    baseUrl: string;
    /** Agent slug to resolve on startup (optional — tools accept slug per-call too) */
    defaultSlug?: string;
}
/** Parse CLI args and env vars into config. */
export declare function parseConfig(argv?: string[]): McpConfig;
//# sourceMappingURL=config.d.ts.map