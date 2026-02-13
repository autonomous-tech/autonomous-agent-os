"use client";

import { useEffect, useState } from "react";
import { useMemoryStore } from "@/stores/memory-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, Loader2, Database, Archive } from "lucide-react";
import { MemoryBlockCard } from "./MemoryBlockCard";
import { cn } from "@/lib/utils";

interface MemoryPanelProps {
  lettaAgentId: string;
}

export function MemoryPanel({ lettaAgentId }: MemoryPanelProps) {
  const {
    blocks,
    archivalResults,
    archivalQuery,
    isLoading,
    setBlocks,
    setArchivalResults,
    setArchivalQuery,
    setLoading,
  } = useMemoryStore();

  const [searchInput, setSearchInput] = useState("");

  // Fetch core memory blocks on mount
  useEffect(() => {
    fetchCoreMemory();
  }, [lettaAgentId]);

  const fetchCoreMemory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/letta/agents/${lettaAgentId}/memory`);
      if (!response.ok) throw new Error("Failed to fetch memory");

      const data = await response.json();
      setBlocks(data.blocks || []);
    } catch (err) {
      console.error("Error fetching core memory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchivalSearch = async () => {
    if (!searchInput.trim()) return;

    try {
      setLoading(true);
      setArchivalQuery(searchInput);

      const response = await fetch(
        `/api/letta/agents/${lettaAgentId}/archival?query=${encodeURIComponent(searchInput)}`
      );
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setArchivalResults(data.results || []);
    } catch (err) {
      console.error("Error searching archival memory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleArchivalSearch();
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          {/* Core Memory Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Core Memory</h2>
            </div>

            {isLoading && blocks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
                <p className="text-sm text-zinc-500">No memory blocks available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blocks.map((block) => (
                  <MemoryBlockCard
                    key={block.id}
                    block={block}
                    lettaAgentId={lettaAgentId}
                    onUpdate={fetchCoreMemory}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Archival Memory Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Archive className="h-5 w-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Archival Memory</h2>
            </div>

            <div className="mb-4 flex gap-2">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search archival memory..."
                className="flex-1 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
              />
              <Button
                onClick={handleArchivalSearch}
                disabled={!searchInput.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {archivalQuery && (
              <div className="space-y-2">
                <div className="text-sm text-zinc-500">
                  Results for "{archivalQuery}" ({archivalResults.length})
                </div>
                {archivalResults.length === 0 ? (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
                    <p className="text-sm text-zinc-500">No results found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {archivalResults.map((passage) => (
                      <div
                        key={passage.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                      >
                        <p className="text-sm text-zinc-300">{passage.text}</p>
                        {passage.tags && passage.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {passage.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {passage.createdAt && (
                          <div className="mt-1 text-xs text-zinc-600">
                            {new Date(passage.createdAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
