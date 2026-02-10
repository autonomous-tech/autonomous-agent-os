// =============================================================================
// Agent OS -- Slug Utility
// =============================================================================

/**
 * Converts an agent name to a URL-safe slug.
 *
 * Rules:
 * - Lowercases the entire string
 * - Replaces spaces and underscores with hyphens
 * - Strips all non-alphanumeric characters (except hyphens)
 * - Collapses consecutive hyphens into one
 * - Trims leading/trailing hyphens
 * - Limits to 50 characters (without breaking mid-word when possible)
 *
 * @param name - The agent name to slugify
 * @returns A URL-safe slug string
 *
 * @example
 * generateSlug("Customer Support Agent") // "customer-support-agent"
 * generateSlug("Helix!!!")               // "helix"
 * generateSlug("My  Super  Agent  Name") // "my-super-agent-name"
 */
export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")       // Replace spaces and underscores with hyphens
    .replace(/[^a-z0-9-]/g, "")    // Strip non-alphanumeric (except hyphens)
    .replace(/-+/g, "-")           // Collapse consecutive hyphens
    .replace(/^-|-$/g, "");        // Trim leading/trailing hyphens

  if (slug.length <= 50) {
    return slug;
  }

  // Truncate to 50 chars without breaking mid-word if possible
  const truncated = slug.substring(0, 50);
  const lastHyphen = truncated.lastIndexOf("-");

  // If there's a hyphen in the last 10 chars, break there for a cleaner slug
  if (lastHyphen > 40) {
    return truncated.substring(0, lastHyphen);
  }

  return truncated.replace(/-$/, "");
}
