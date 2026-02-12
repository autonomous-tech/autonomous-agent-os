import { RuntimeChat } from "@/components/runtime/RuntimeChat";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AgentPage({ params }: PageProps) {
  const { slug } = await params;
  return <RuntimeChat slug={slug} />;
}
