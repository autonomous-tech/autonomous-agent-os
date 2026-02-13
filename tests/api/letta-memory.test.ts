// =============================================================================
// Agent OS -- API Tests: Letta Memory & Archival Routes
// =============================================================================
// Tests for Letta memory block CRUD and archival memory search/insert.
// Source: src/app/api/letta/agents/[lettaId]/memory/route.ts
//         src/app/api/letta/agents/[lettaId]/memory/[label]/route.ts
//         src/app/api/letta/agents/[lettaId]/archival/route.ts
// =============================================================================

import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { parseResponse } from "../helpers/db";

// ---------------------------------------------------------------------------
// Mock the Letta client module
// ---------------------------------------------------------------------------

const mockBlocksList = vi.fn();
const mockBlocksRetrieve = vi.fn();
const mockBlocksUpdate = vi.fn();
const mockPassagesSearch = vi.fn();
const mockPassagesList = vi.fn();
const mockPassagesCreate = vi.fn();

const mockIsLettaEnabled = vi.fn().mockReturnValue(true);

vi.mock("@/lib/letta/client", () => ({
  isLettaEnabled: (...args: unknown[]) => mockIsLettaEnabled(...args),
  lettaClient: {
    agents: {
      blocks: {
        list: (...args: unknown[]) => mockBlocksList(...args),
        retrieve: (...args: unknown[]) => mockBlocksRetrieve(...args),
        update: (...args: unknown[]) => mockBlocksUpdate(...args),
      },
      passages: {
        search: (...args: unknown[]) => mockPassagesSearch(...args),
        list: (...args: unknown[]) => mockPassagesList(...args),
        create: (...args: unknown[]) => mockPassagesCreate(...args),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Import route handlers (after mock setup)
// ---------------------------------------------------------------------------

import { GET as listBlocks } from "@/app/api/letta/agents/[lettaId]/memory/route";
import {
  GET as getBlock,
  PUT as updateBlock,
} from "@/app/api/letta/agents/[lettaId]/memory/[label]/route";
import {
  GET as searchArchival,
  POST as insertArchival,
} from "@/app/api/letta/agents/[lettaId]/archival/route";

// ---------------------------------------------------------------------------
// Shared constants & helpers
// ---------------------------------------------------------------------------

const LETTA_AGENT_ID = "letta-agent-1";

function makeParams(lettaId: string = LETTA_AGENT_ID) {
  return Promise.resolve({ lettaId });
}

function makeLabelParams(
  lettaId: string = LETTA_AGENT_ID,
  label: string = "persona"
) {
  return Promise.resolve({ lettaId, label });
}

function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

/** Helper to create an async iterable from an array of items. */
function asyncIterable<T>(items: T[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) {
        yield item;
      }
    },
  };
}

// Sample block data as returned by the Letta SDK
const sampleBlock = {
  id: "block-1",
  label: "persona",
  value: "I am a helpful assistant",
  limit: 5000,
  description: "Agent persona block",
  read_only: false,
};

const sampleBlock2 = {
  id: "block-2",
  label: "human",
  value: "The user is a developer",
  limit: 5000,
  description: "Human information block",
  read_only: true,
};

// Sample passage data
const samplePassage = {
  id: "passage-1",
  text: "Important context about the project",
  created_at: "2025-01-15T10:00:00Z",
  tags: ["context"],
};

const samplePassage2 = {
  id: "passage-2",
  text: "Another piece of archival memory",
  created_at: "2025-01-16T10:00:00Z",
  tags: [],
};

// Sample search result
const sampleSearchResult = {
  id: "passage-1",
  content: "Important context about the project",
  timestamp: "2025-01-15T10:00:00Z",
  tags: ["context"],
};

// =============================================================================
// Test Suite
// =============================================================================

describe("Letta Memory & Archival API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLettaEnabled.mockReturnValue(true);
  });

  // =========================================================================
  // 503 — Letta Not Configured
  // =========================================================================

  describe("503 when Letta is not configured", () => {
    beforeEach(() => {
      mockIsLettaEnabled.mockReturnValue(false);
    });

    it("GET /memory returns 503", async () => {
      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory`
      );
      const response = await listBlocks(request, { params: makeParams() });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(503);
      expect(body.error).toBe("Letta not configured");
    });

    it("GET /memory/[label] returns 503", async () => {
      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`
      );
      const response = await getBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(503);
      expect(body.error).toBe("Letta not configured");
    });

    it("PUT /memory/[label] returns 503", async () => {
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: "updated" }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(503);
      expect(body.error).toBe("Letta not configured");
    });

    it("GET /archival returns 503", async () => {
      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`
      );
      const response = await searchArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(503);
      expect(body.error).toBe("Letta not configured");
    });

    it("POST /archival returns 503", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "some text" }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(503);
      expect(body.error).toBe("Letta not configured");
    });
  });

  // =========================================================================
  // GET /api/letta/agents/[lettaId]/memory — List all memory blocks
  // =========================================================================

  describe("GET /api/letta/agents/[lettaId]/memory", () => {
    it("returns all memory blocks with mapped fields", async () => {
      mockBlocksList.mockReturnValue(
        asyncIterable([sampleBlock, sampleBlock2])
      );

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory`
      );
      const response = await listBlocks(request, { params: makeParams() });
      const { status, body } = await parseResponse<{
        blocks: Array<{
          id: string;
          label: string;
          value: string;
          limit: number;
          description: string;
          readOnly: boolean;
        }>;
      }>(response);

      expect(status).toBe(200);
      expect(body.blocks).toHaveLength(2);

      // First block
      expect(body.blocks[0]).toEqual({
        id: "block-1",
        label: "persona",
        value: "I am a helpful assistant",
        limit: 5000,
        description: "Agent persona block",
        readOnly: false,
      });

      // Second block — read_only should be mapped to readOnly
      expect(body.blocks[1]).toEqual({
        id: "block-2",
        label: "human",
        value: "The user is a developer",
        limit: 5000,
        description: "Human information block",
        readOnly: true,
      });

      expect(mockBlocksList).toHaveBeenCalledWith(LETTA_AGENT_ID);
    });

    it("returns empty blocks array when no blocks exist", async () => {
      mockBlocksList.mockReturnValue(asyncIterable([]));

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory`
      );
      const response = await listBlocks(request, { params: makeParams() });
      const { status, body } = await parseResponse<{
        blocks: unknown[];
      }>(response);

      expect(status).toBe(200);
      expect(body.blocks).toEqual([]);
    });

    it("returns 500 when Letta SDK throws", async () => {
      mockBlocksList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error("Letta SDK connection error");
        },
      });

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory`
      );
      const response = await listBlocks(request, { params: makeParams() });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to fetch memory blocks");
    });

    it("passes the correct lettaId from params", async () => {
      const customId = "custom-letta-agent-99";
      mockBlocksList.mockReturnValue(asyncIterable([]));

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${customId}/memory`
      );
      const response = await listBlocks(request, {
        params: Promise.resolve({ lettaId: customId }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
      expect(mockBlocksList).toHaveBeenCalledWith(customId);
    });
  });

  // =========================================================================
  // GET /api/letta/agents/[lettaId]/memory/[label] — Get specific block
  // =========================================================================

  describe("GET /api/letta/agents/[lettaId]/memory/[label]", () => {
    it("returns a single block with mapped fields", async () => {
      mockBlocksRetrieve.mockResolvedValue(sampleBlock);

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`
      );
      const response = await getBlock(request, {
        params: makeLabelParams(LETTA_AGENT_ID, "persona"),
      });
      const { status, body } = await parseResponse<{
        id: string;
        label: string;
        value: string;
        limit: number;
        description: string;
        readOnly: boolean;
      }>(response);

      expect(status).toBe(200);
      expect(body).toEqual({
        id: "block-1",
        label: "persona",
        value: "I am a helpful assistant",
        limit: 5000,
        description: "Agent persona block",
        readOnly: false,
      });

      expect(mockBlocksRetrieve).toHaveBeenCalledWith("persona", {
        agent_id: LETTA_AGENT_ID,
      });
    });

    it("passes correct label and lettaId to the SDK", async () => {
      mockBlocksRetrieve.mockResolvedValue(sampleBlock2);

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/human`
      );
      const response = await getBlock(request, {
        params: makeLabelParams(LETTA_AGENT_ID, "human"),
      });
      const { status, body } = await parseResponse<{
        readOnly: boolean;
      }>(response);

      expect(status).toBe(200);
      expect(body.readOnly).toBe(true);
      expect(mockBlocksRetrieve).toHaveBeenCalledWith("human", {
        agent_id: LETTA_AGENT_ID,
      });
    });

    it("returns 500 when Letta SDK throws", async () => {
      mockBlocksRetrieve.mockRejectedValue(new Error("Block not found"));

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`
      );
      const response = await getBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to fetch memory block");
    });
  });

  // =========================================================================
  // PUT /api/letta/agents/[lettaId]/memory/[label] — Update block
  // =========================================================================

  describe("PUT /api/letta/agents/[lettaId]/memory/[label]", () => {
    it("updates a block and returns the updated data", async () => {
      const updatedBlock = {
        id: "block-1",
        label: "persona",
        value: "I am now a specialized assistant",
        limit: 5000,
      };
      mockBlocksUpdate.mockResolvedValue(updatedBlock);

      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: "I am now a specialized assistant" }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(LETTA_AGENT_ID, "persona"),
      });
      const { status, body } = await parseResponse<{
        id: string;
        label: string;
        value: string;
        limit: number;
      }>(response);

      expect(status).toBe(200);
      expect(body).toEqual({
        id: "block-1",
        label: "persona",
        value: "I am now a specialized assistant",
        limit: 5000,
      });

      expect(mockBlocksUpdate).toHaveBeenCalledWith("persona", {
        agent_id: LETTA_AGENT_ID,
        value: "I am now a specialized assistant",
      });
    });

    it("returns 400 when value is missing", async () => {
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        {}
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid value");
    });

    it("returns 400 when value is not a string (number)", async () => {
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: 12345 }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid value");
    });

    it("returns 400 when value is not a string (array)", async () => {
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: ["not", "a", "string"] }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid value");
    });

    it("returns 400 when value is null", async () => {
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: null }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid value");
    });

    it("returns 400 when value is an empty string", async () => {
      // The route checks `!body.value` — empty string is falsy
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: "" }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid value");
    });

    it("returns 400 when value exceeds 10000 characters", async () => {
      const longValue = "x".repeat(10001);
      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: longValue }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Value exceeds 10000 character limit");
    });

    it("accepts value at exactly 10000 characters", async () => {
      const exactValue = "x".repeat(10000);
      const updatedBlock = {
        id: "block-1",
        label: "persona",
        value: exactValue,
        limit: 10000,
      };
      mockBlocksUpdate.mockResolvedValue(updatedBlock);

      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: exactValue }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{
        value: string;
      }>(response);

      expect(status).toBe(200);
      expect(body.value).toBe(exactValue);
    });

    it("returns 500 when Letta SDK throws", async () => {
      mockBlocksUpdate.mockRejectedValue(new Error("SDK update failed"));

      const request = makeRequest(
        "PUT",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/memory/persona`,
        { value: "valid value" }
      );
      const response = await updateBlock(request, {
        params: makeLabelParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to update memory block");
    });
  });

  // =========================================================================
  // GET /api/letta/agents/[lettaId]/archival — Search/list archival
  // =========================================================================

  describe("GET /api/letta/agents/[lettaId]/archival", () => {
    // -----------------------------------------------------------------------
    // Semantic search (with ?q=query)
    // -----------------------------------------------------------------------

    describe("with search query (?q=...)", () => {
      it("performs semantic search and returns mapped passages", async () => {
        mockPassagesSearch.mockResolvedValue({
          results: [sampleSearchResult],
          count: 1,
        });

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival?q=project`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status, body } = await parseResponse<{
          passages: Array<{
            id: string;
            content: string;
            timestamp: string;
            tags: string[];
          }>;
          count: number;
        }>(response);

        expect(status).toBe(200);
        expect(body.passages).toHaveLength(1);
        expect(body.passages[0]).toEqual({
          id: "passage-1",
          content: "Important context about the project",
          timestamp: "2025-01-15T10:00:00Z",
          tags: ["context"],
        });
        expect(body.count).toBe(1);

        expect(mockPassagesSearch).toHaveBeenCalledWith(LETTA_AGENT_ID, {
          query: "project",
        });
      });

      it("returns empty results for no matches", async () => {
        mockPassagesSearch.mockResolvedValue({
          results: [],
          count: 0,
        });

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival?q=nonexistent`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status, body } = await parseResponse<{
          passages: unknown[];
          count: number;
        }>(response);

        expect(status).toBe(200);
        expect(body.passages).toEqual([]);
        expect(body.count).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // List all (without query)
    // -----------------------------------------------------------------------

    describe("without search query (list all)", () => {
      it("lists passages with default limit of 20", async () => {
        mockPassagesList.mockReturnValue(
          asyncIterable([samplePassage, samplePassage2])
        );

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status, body } = await parseResponse<{
          passages: Array<{
            id: string;
            text: string;
            created_at: string;
            tags: string[];
          }>;
        }>(response);

        expect(status).toBe(200);
        expect(body.passages).toHaveLength(2);
        expect(body.passages[0]).toEqual({
          id: "passage-1",
          text: "Important context about the project",
          created_at: "2025-01-15T10:00:00Z",
          tags: ["context"],
        });
        expect(body.passages[1]).toEqual({
          id: "passage-2",
          text: "Another piece of archival memory",
          created_at: "2025-01-16T10:00:00Z",
          tags: [],
        });

        expect(mockPassagesList).toHaveBeenCalledWith(LETTA_AGENT_ID, {
          limit: 20,
        });
      });

      it("respects custom limit parameter", async () => {
        mockPassagesList.mockReturnValue(asyncIterable([]));

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival?limit=50`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status } = await parseResponse(response);

        expect(status).toBe(200);
        expect(mockPassagesList).toHaveBeenCalledWith(LETTA_AGENT_ID, {
          limit: 50,
        });
      });

      it("caps limit at 100", async () => {
        mockPassagesList.mockReturnValue(asyncIterable([]));

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival?limit=999`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status } = await parseResponse(response);

        expect(status).toBe(200);
        expect(mockPassagesList).toHaveBeenCalledWith(LETTA_AGENT_ID, {
          limit: 100,
        });
      });

      it("returns empty array when no passages exist", async () => {
        mockPassagesList.mockReturnValue(asyncIterable([]));

        const request = makeRequest(
          "GET",
          `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`
        );
        const response = await searchArchival(request, {
          params: makeParams(),
        });
        const { status, body } = await parseResponse<{
          passages: unknown[];
        }>(response);

        expect(status).toBe(200);
        expect(body.passages).toEqual([]);
      });
    });

    it("returns 500 when Letta SDK throws on search", async () => {
      mockPassagesSearch.mockRejectedValue(
        new Error("Archival search error")
      );

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival?q=test`
      );
      const response = await searchArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to search archival memory");
    });

    it("returns 500 when Letta SDK throws on list", async () => {
      mockPassagesList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error("Archival list error");
        },
      });

      const request = makeRequest(
        "GET",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`
      );
      const response = await searchArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to search archival memory");
    });
  });

  // =========================================================================
  // POST /api/letta/agents/[lettaId]/archival — Insert passage
  // =========================================================================

  describe("POST /api/letta/agents/[lettaId]/archival", () => {
    it("creates a passage and returns 201", async () => {
      const createdPassage = {
        id: "passage-new",
        text: "New archival memory entry",
        created_at: "2025-01-17T10:00:00Z",
        tags: [],
      };
      mockPassagesCreate.mockResolvedValue(createdPassage);

      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "New archival memory entry" }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{
        passages: { id: string; text: string };
      }>(response);

      expect(status).toBe(201);
      expect(body.passages).toEqual(createdPassage);

      expect(mockPassagesCreate).toHaveBeenCalledWith(LETTA_AGENT_ID, {
        text: "New archival memory entry",
      });
    });

    it("passes tags to the SDK when provided", async () => {
      const createdPassage = {
        id: "passage-tagged",
        text: "Tagged memory",
        created_at: "2025-01-17T10:00:00Z",
        tags: ["important", "context"],
      };
      mockPassagesCreate.mockResolvedValue(createdPassage);

      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "Tagged memory", tags: ["important", "context"] }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{
        passages: { tags: string[] };
      }>(response);

      expect(status).toBe(201);
      expect(body.passages.tags).toEqual(["important", "context"]);

      expect(mockPassagesCreate).toHaveBeenCalledWith(LETTA_AGENT_ID, {
        text: "Tagged memory",
        tags: ["important", "context"],
      });
    });

    it("does not pass tags when not provided", async () => {
      mockPassagesCreate.mockResolvedValue({ id: "passage-new" });

      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "No tags here" }
      );
      await insertArchival(request, { params: makeParams() });

      expect(mockPassagesCreate).toHaveBeenCalledWith(LETTA_AGENT_ID, {
        text: "No tags here",
      });
    });

    it("returns 400 when text is missing", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        {}
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid text");
    });

    it("returns 400 when text is not a string (number)", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: 42 }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid text");
    });

    it("returns 400 when text is not a string (boolean)", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: true }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid text");
    });

    it("returns 400 when text is null", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: null }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid text");
    });

    it("returns 400 when text is an empty string", async () => {
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "" }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Missing or invalid text");
    });

    it("returns 400 when text exceeds 50000 characters", async () => {
      const longText = "x".repeat(50001);
      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: longText }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(body.error).toBe("Text exceeds 50000 character limit");
    });

    it("accepts text at exactly 50000 characters", async () => {
      const exactText = "x".repeat(50000);
      mockPassagesCreate.mockResolvedValue({
        id: "passage-max",
        text: exactText,
      });

      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: exactText }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(201);
      expect(mockPassagesCreate).toHaveBeenCalledWith(LETTA_AGENT_ID, {
        text: exactText,
      });
    });

    it("returns 500 when Letta SDK throws", async () => {
      mockPassagesCreate.mockRejectedValue(
        new Error("SDK insertion failed")
      );

      const request = makeRequest(
        "POST",
        `http://localhost:3000/api/letta/agents/${LETTA_AGENT_ID}/archival`,
        { text: "valid text" }
      );
      const response = await insertArchival(request, {
        params: makeParams(),
      });
      const { status, body } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to insert into archival memory");
    });
  });
});
