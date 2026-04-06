#!/usr/bin/env node

/**
 * Agent OS MCP Server entry point.
 *
 * Usage:
 *   npx agent-os-mcp --url http://localhost:3000
 *   agent-os-mcp --url http://localhost:3000
 *
 * Or add to .mcp.json:
 *   { "mcpServers": { "agent-os": { "command": "npx", "args": ["agent-os-mcp", "--url", "http://localhost:3000"] } } }
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the compiled entry point
const { startServer } = await import(join(__dirname, "..", "dist", "index.js"));
startServer();
