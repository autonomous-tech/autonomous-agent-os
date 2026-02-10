"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentCardProps {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  building: "secondary",
  exported: "default",
};

export function AgentCard({
  id,
  name,
  description,
  status,
  createdAt,
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
