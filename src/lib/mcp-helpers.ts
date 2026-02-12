// ── Shared MCP Server Helpers ─────────────────────────────────────────
// Validation, parsing, and constants shared across MCP server API routes.

import { NextResponse } from "next/server";
import type { McpServerDefinition } from "@/lib/runtime/tools.types";

// ── Constants ────────────────────────────────────────────────────────

export const VALID_TRANSPORTS = ["stdio", "sse", "http"] as const;
export const VALID_STATUSES = ["active", "inactive"] as const;
export const MAX_NAME_LENGTH = 100;

export const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "transport",
  "command",
  "args",
  "url",
  "env",
  "allowedTools",
  "blockedTools",
  "sandboxConfig",
  "status",
]);

/** Fields stored as JSON strings in the database. */
const JSON_FIELDS = [
  "args",
  "env",
  "allowedTools",
  "blockedTools",
  "sandboxConfig",
] as const;

// ── JSON Parsing ─────────────────────────────────────────────────────

/** Parse all JSON string fields on an McpServerConfig row into real values. Redacts env var values. */
export function parseServerRow(row: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        // leave as-is if unparseable
      }
    }
  }
  // Redact env variable values in API responses
  if (parsed.env && typeof parsed.env === "object" && !Array.isArray(parsed.env)) {
    const redacted: Record<string, string> = {};
    for (const key of Object.keys(parsed.env as Record<string, string>)) {
      const val = (parsed.env as Record<string, string>)[key];
      redacted[key] = val ? "***" : "";
    }
    parsed.env = redacted;
  }
  return parsed;
}

/** Safely parse a JSON string expected to be an array, returning [] on failure. */
export function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Safely parse a JSON string expected to be an object, returning {} on failure. */
export function safeParseObject(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

// ── Validation Helpers ───────────────────────────────────────────────

/** Allowed commands for stdio transport (defense against arbitrary command execution). */
const ALLOWED_COMMANDS = new Set(["npx", "node", "python3", "uvx", "docker"]);

/** Blocked environment variable names that could hijack child processes. */
const BLOCKED_ENV_KEYS = new Set([
  "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES",
  "NODE_OPTIONS", "PYTHONPATH", "PATH", "SHELL",
]);

/** IP patterns that indicate internal/private network addresses (SSRF protection). */
function isPrivateUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "[::1]") return true;
  // IPv4 private ranges + link-local + loopback
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;                        // 127.0.0.0/8
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (cloud metadata)
    if (a === 0) return true;                           // 0.0.0.0
  }
  return false;
}

/** URL format validation: must be http/https and not target private networks. */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (isPrivateUrl(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Validate that a value is a non-null, non-array object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate common MCP server fields from a request body.
 * Returns a 400 NextResponse if validation fails, or null if all fields are valid.
 */
export function validateMcpFields(body: Record<string, unknown>): NextResponse | null {
  if (body.args !== undefined && !Array.isArray(body.args)) {
    return NextResponse.json({ error: "args must be an array" }, { status: 400 });
  }
  if (body.env !== undefined && !isPlainObject(body.env)) {
    return NextResponse.json({ error: "env must be an object" }, { status: 400 });
  }
  if (body.env !== undefined && isPlainObject(body.env)) {
    const blockedKeys = Object.keys(body.env).filter((k) => BLOCKED_ENV_KEYS.has(k));
    if (blockedKeys.length > 0) {
      return NextResponse.json(
        { error: `Environment variables not allowed: ${blockedKeys.join(", ")}` },
        { status: 400 }
      );
    }
  }
  if (body.allowedTools !== undefined && !Array.isArray(body.allowedTools)) {
    return NextResponse.json({ error: "allowedTools must be an array" }, { status: 400 });
  }
  if (body.blockedTools !== undefined && !Array.isArray(body.blockedTools)) {
    return NextResponse.json({ error: "blockedTools must be an array" }, { status: 400 });
  }
  if (body.sandboxConfig !== undefined && !isPlainObject(body.sandboxConfig)) {
    return NextResponse.json({ error: "sandboxConfig must be an object" }, { status: 400 });
  }
  return null;
}

/**
 * Validate transport-specific requirements:
 * - stdio requires a non-empty command
 * - sse/http require a valid URL
 */
export function validateTransportFields(
  transport: string,
  command: unknown,
  url: unknown
): NextResponse | null {
  if (transport === "stdio") {
    if (typeof command !== "string" || command.trim().length === 0) {
      return NextResponse.json(
        { error: "command is required for stdio transport" },
        { status: 400 }
      );
    }
    if (!ALLOWED_COMMANDS.has(command.trim())) {
      return NextResponse.json(
        { error: `command must be one of: ${[...ALLOWED_COMMANDS].join(", ")}` },
        { status: 400 }
      );
    }
  } else {
    if (typeof url !== "string" || !isValidUrl(url)) {
      return NextResponse.json(
        { error: "A valid public http/https url is required for sse and http transports" },
        { status: 400 }
      );
    }
  }
  return null;
}

// ── Database Row Conversion ──────────────────────────────────────────

/** Convert an McpServerConfig database row to an McpServerDefinition. */
export function rowToDefinition(server: {
  name: string;
  transport: string;
  command: string | null;
  args: string;
  url: string | null;
  env: string;
  allowedTools: string;
  blockedTools: string;
  sandboxConfig: string;
  status: string;
}): McpServerDefinition {
  return {
    name: server.name,
    transport: server.transport as McpServerDefinition["transport"],
    command: server.command ?? undefined,
    args: safeParseArray(server.args),
    url: server.url ?? undefined,
    env: safeParseObject(server.env),
    allowedTools: safeParseArray(server.allowedTools),
    blockedTools: safeParseArray(server.blockedTools),
    sandbox: safeParseObject(server.sandboxConfig),
    status: server.status as "active" | "inactive",
  };
}
