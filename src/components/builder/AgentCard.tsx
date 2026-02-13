"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const isDeployed = status === "deployed";
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/agents/${id}`}>
      <Card className={`cursor-pointer transition-colors hover:bg-accent/50 ${isDeployed ? "border-l-2 border-l-green-500" : ""}`}>
        <CardContent className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-base font-medium">{name}</span>
              {isDeployed ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  deployed
                </Badge>
              ) : (
                <Badge variant={statusVariant[status] || "outline"}>
                  {status}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDeployed && slug && (
              <Button
                size="xs"
                variant="outline"
                className="text-green-600 border-green-500/30 hover:bg-green-500/10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(`/a/${slug}`, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {date}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
