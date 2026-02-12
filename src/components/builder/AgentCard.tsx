"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface AgentCardProps {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  slug?: string;
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  building: "secondary",
  exported: "default",
  deployed: "default",
};

export function AgentCard({
  id,
  name,
  description,
  status,
  createdAt,
  slug,
}: AgentCardProps) {
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/agents/${id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-base font-medium">{name}</span>
              <Badge variant={statusVariant[status] || "outline"}>
                {status}
              </Badge>
              {status === "deployed" && slug && (
                <a
                  href={`/a/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {description}
              </p>
            )}
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {date}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
