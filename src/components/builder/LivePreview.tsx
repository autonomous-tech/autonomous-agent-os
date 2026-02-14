"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Download, Code, Eye } from "lucide-react";
import {
  generateAgentMd,
  generateMcpJson,
  generateSettingsJson,
} from "@/lib/claude-code/generate-agent";
import type { AgentConfig } from "@/lib/types";

interface LivePreviewProps {
  slug: string;
  config: AgentConfig;
  lettaAgentId?: string | null;
  agentOsUrl?: string;
  activeSection?: string;
}

type FileTab = "agent.md" | ".mcp.json" | "settings.json";

const SECTION_HEADINGS: Record<string, string> = {
  identity: "# ",
  purpose: "## Purpose",
  audience: "## Audience",
  workflow: "## Workflow",
  memory: "## Memory Protocol",
  boundaries: "## Boundaries",
};

export function LivePreview({
  slug,
  config,
  lettaAgentId,
  agentOsUrl = "http://localhost:3000",
  activeSection,
}: LivePreviewProps) {
  const [activeTab, setActiveTab] = useState<FileTab>("agent.md");
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const files = useMemo(() => ({
    "agent.md": generateAgentMd({ slug: slug || "untitled", config, lettaAgentId }),
    ".mcp.json": generateMcpJson(slug || "untitled", agentOsUrl),
    "settings.json": generateSettingsJson(slug || "untitled", agentOsUrl),
  }), [slug, config, lettaAgentId, agentOsUrl]);

  const content = files[activeTab];

  function handleCopy() {
    navigator.clipboard.writeText(content).catch(() => {
      // Clipboard API may fail if page is not focused
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const filename = activeTab === "agent.md" ? `${slug || "agent"}.md` : activeTab;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar + toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FileTab)}>
          <TabsList className="h-7 bg-zinc-900">
            <TabsTrigger value="agent.md" className="text-xs h-6 px-2">
              agent.md
            </TabsTrigger>
            <TabsTrigger value=".mcp.json" className="text-xs h-6 px-2">
              .mcp.json
            </TabsTrigger>
            <TabsTrigger value="settings.json" className="text-xs h-6 px-2">
              settings.json
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowRaw(!showRaw)}
            aria-label={showRaw ? "Show rendered" : "Show raw"}
          >
            {showRaw ? <Eye className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDownload}
            aria-label="Download file"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {showRaw || activeTab !== "agent.md" ? (
            <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {content}
            </pre>
          ) : (
            <RenderedMarkdown content={content} activeSection={activeSection} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RenderedMarkdown({
  content,
  activeSection,
}: {
  content: string;
  activeSection?: string;
}) {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterDone = false;
  const elements: React.ReactNode[] = [];
  let currentSectionKey: string | null = null;

  function getSectionKey(line: string): string | null {
    for (const [key, heading] of Object.entries(SECTION_HEADINGS)) {
      if (key === "identity" && line.startsWith("# ") && !line.startsWith("## ")) return key;
      if (key !== "identity" && line.startsWith(heading)) return key;
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle frontmatter
    if (line === "---" && !frontmatterDone) {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        inFrontmatter = false;
        frontmatterDone = true;
        continue;
      }
    }
    if (inFrontmatter) {
      elements.push(
        <div key={`fm-${i}`} className="text-xs font-mono text-zinc-500">
          {line}
        </div>
      );
      continue;
    }

    // Track section
    const sectionKey = getSectionKey(line);
    if (sectionKey) currentSectionKey = sectionKey;

    const isActive = activeSection && currentSectionKey === activeSection;
    const activeBorder = isActive ? "border-l-2 border-blue-500" : "";

    // Render based on markdown type
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className={`text-xs font-semibold text-zinc-300 mt-3 mb-1 pl-2 ${activeBorder}`}>
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className={`text-sm font-semibold text-zinc-200 mt-4 mb-1 pl-2 ${activeBorder}`}>
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className={`text-base font-bold text-zinc-100 mt-2 mb-1 pl-2 ${activeBorder}`}>
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className={`text-xs text-zinc-400 pl-4 py-0.5 flex items-start gap-1.5 ${isActive ? "border-l-2 border-blue-500 ml-2" : ""}`}>
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
          <span className="font-mono">{renderInlineCode(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className={`text-xs text-zinc-400 pl-2 ${activeBorder}`}>
          {renderInlineCode(line)}
        </p>
      );
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

function renderInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="text-blue-400 bg-zinc-800/50 rounded px-1 py-0.5 text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
