import { lettaClient, isLettaEnabled } from "./client";
import fs from "fs/promises";
import path from "path";

/**
 * Result of loading a skill into archival memory.
 */
export interface SkillLoadResult {
  chunks: number;
}

/**
 * Result of loading multiple skills from a directory.
 */
export interface BulkSkillLoadResult {
  loaded: string[];
  errors: string[];
}

/**
 * Load a SKILL.md file from disk and insert it into an agent's archival memory.
 *
 * Large skills are split into chunks of approximately 1000 characters at paragraph
 * boundaries to stay within Letta's token limits. Each chunk is tagged with the
 * skill name for easy retrieval.
 *
 * @param lettaAgentId - The Letta agent ID
 * @param skillPath - Absolute path to the SKILL.md file
 * @returns Object containing the number of chunks inserted
 * @throws Error if Letta is not enabled, file not found, or insertion fails
 */
export async function loadSkillToArchival(
  lettaAgentId: string,
  skillPath: string
): Promise<SkillLoadResult> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  try {
    // Read the skill file
    const content = await fs.readFile(skillPath, "utf-8");
    if (!content || content.trim().length === 0) {
      throw new Error(`Skill file is empty: ${skillPath}`);
    }

    // Extract skill name from the file path
    const skillName = path.basename(path.dirname(skillPath));

    // Split into chunks at paragraph boundaries (~1000 chars)
    const chunks = chunkSkillContent(content, skillName);

    // Insert each chunk into archival memory
    await Promise.all(
      chunks.map((chunk) =>
        lettaClient!.agents.passages.create(lettaAgentId, {
          text: chunk,
          tags: [skillName, "skill"],
        })
      )
    );

    return { chunks: chunks.length };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Skill file not found: ${skillPath}`);
    }
    throw new Error(
      `Failed to load skill from ${skillPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load all SKILL.md files from a directory into an agent's archival memory.
 *
 * Scans the directory recursively for SKILL.md files and loads each one.
 * Continues loading even if individual files fail (reports errors at the end).
 *
 * @param lettaAgentId - The Letta agent ID
 * @param skillsDir - Absolute path to the skills directory
 * @returns Object containing arrays of successfully loaded skills and errors
 * @throws Error if Letta is not enabled or directory doesn't exist
 */
export async function loadSkillsDirectory(
  lettaAgentId: string,
  skillsDir: string
): Promise<BulkSkillLoadResult> {
  if (!isLettaEnabled() || !lettaClient) {
    throw new Error("Letta is not enabled. Set LETTA_BASE_URL in .env");
  }

  const loaded: string[] = [];
  const errors: string[] = [];

  try {
    // Find all SKILL.md files recursively
    const skillFiles = await findSkillFiles(skillsDir);

    if (skillFiles.length === 0) {
      return { loaded, errors: [`No SKILL.md files found in ${skillsDir}`] };
    }

    // Load each skill (don't fail on individual errors)
    await Promise.all(
      skillFiles.map(async (skillPath) => {
        try {
          await loadSkillToArchival(lettaAgentId, skillPath);
          loaded.push(path.basename(path.dirname(skillPath)));
        } catch (error) {
          errors.push(
            `${path.basename(path.dirname(skillPath))}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );

    return { loaded, errors };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Skills directory not found: ${skillsDir}`);
    }
    throw new Error(
      `Failed to load skills from ${skillsDir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Split skill content into chunks at paragraph boundaries.
 * Aims for ~1000 characters per chunk but doesn't break mid-paragraph.
 *
 * @param content - The full skill file content
 * @param skillName - Name of the skill (for metadata header)
 * @returns Array of text chunks ready for archival insertion
 */
function chunkSkillContent(content: string, skillName: string): string[] {
  const MAX_CHUNK_SIZE = 1000;
  const chunks: string[] = [];

  // Split into paragraphs (double newline or heading)
  const paragraphs = content.split(/\n\n+/);

  let currentChunk = `[SKILL: ${skillName}]\n\n`;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed max size, save current chunk
    if (
      currentChunk.length + trimmed.length > MAX_CHUNK_SIZE &&
      currentChunk.length > 50
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = `[SKILL: ${skillName}]\n\n`;
    }

    currentChunk += trimmed + "\n\n";
  }

  // Save final chunk if not empty
  if (currentChunk.trim().length > 50) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [content]; // Fallback to full content if chunking failed
}

/**
 * Recursively find all SKILL.md files in a directory.
 *
 * @param dir - Directory to search
 * @returns Array of absolute paths to SKILL.md files
 */
async function findSkillFiles(dir: string): Promise<string[]> {
  const skillFiles: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const nestedFiles = await findSkillFiles(fullPath);
        skillFiles.push(...nestedFiles);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        skillFiles.push(fullPath);
      }
    }

    return skillFiles;
  } catch (error) {
    // Silently skip directories we can't read
    return skillFiles;
  }
}
