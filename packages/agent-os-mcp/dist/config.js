/**
 * MCP server configuration — CLI args, env vars, and agent resolution.
 */
/** Parse CLI args and env vars into config. */
export function parseConfig(argv = process.argv.slice(2)) {
    let baseUrl = process.env.AGENT_OS_URL ?? "http://localhost:3000";
    let defaultSlug;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if ((arg === "--url" || arg === "-u") && argv[i + 1]) {
            baseUrl = argv[++i];
        }
        else if ((arg === "--agent" || arg === "-a") && argv[i + 1]) {
            defaultSlug = argv[++i];
        }
        else if (arg.startsWith("--url=")) {
            baseUrl = arg.split("=")[1];
        }
        else if (arg.startsWith("--agent=")) {
            defaultSlug = arg.split("=")[1];
        }
    }
    // Normalize: strip trailing slash
    baseUrl = baseUrl.replace(/\/+$/, "");
    return { baseUrl, defaultSlug };
}
//# sourceMappingURL=config.js.map