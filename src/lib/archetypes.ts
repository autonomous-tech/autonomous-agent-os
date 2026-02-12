export interface Archetype {
  id: string;
  emoji: string;
  name: string;
  description: string;
  suggestedNames: string[];
  defaultConfig: {
    tone: string;
    audience: string;
    tasks: string[];
  };
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "support",
    emoji: "🎧",
    name: "Support",
    description: "Answer questions, resolve issues, escalate when needed",
    suggestedNames: ["Fixie", "Helpdesk", "Assist"],
    defaultConfig: {
      tone: "friendly",
      audience: "End users and customers",
      tasks: ["Answer FAQs", "Troubleshoot issues", "Escalate complex cases"],
    },
  },
  {
    id: "research",
    emoji: "🔬",
    name: "Research",
    description: "Monitor topics, summarize findings, maintain knowledge",
    suggestedNames: ["Helix", "Scout", "Sage"],
    defaultConfig: {
      tone: "professional",
      audience: "Research and analysis teams",
      tasks: ["Monitor sources", "Summarize findings", "Track trends"],
    },
  },
  {
    id: "sales",
    emoji: "📈",
    name: "Sales",
    description: "Draft outreach, research prospects, prepare for calls",
    suggestedNames: ["Closer", "Pipeline", "Pitch"],
    defaultConfig: {
      tone: "professional",
      audience: "Sales team members",
      tasks: ["Research prospects", "Draft outreach", "Prepare call briefs"],
    },
  },
  {
    id: "operations",
    emoji: "⚙️",
    name: "Operations",
    description: "Automate workflows, monitor systems, handle alerts",
    suggestedNames: ["Ops", "Flow", "Relay"],
    defaultConfig: {
      tone: "concise",
      audience: "Internal operations team",
      tasks: ["Monitor systems", "Route alerts", "Automate workflows"],
    },
  },
  {
    id: "creative",
    emoji: "✨",
    name: "Creative",
    description: "Generate content, brainstorm ideas, adapt tone and style",
    suggestedNames: ["Muse", "Spark", "Draft"],
    defaultConfig: {
      tone: "casual",
      audience: "Content and marketing teams",
      tasks: ["Generate drafts", "Brainstorm ideas", "Adapt content for channels"],
    },
  },
  {
    id: "custom",
    emoji: "🧩",
    name: "Custom",
    description: "Start from scratch with your own description",
    suggestedNames: ["Agent", "Helper", "Bot"],
    defaultConfig: {
      tone: "friendly",
      audience: "General users",
      tasks: [],
    },
  },
];

export const AUDIENCE_OPTIONS = [
  { id: "owner-only", label: "Just me", description: "Personal assistant, only you interact with it" },
  { id: "team", label: "My team", description: "Shared within your team or organization" },
  { id: "public", label: "Anyone", description: "Public-facing, anyone can interact" },
] as const;

export type AudienceScope = (typeof AUDIENCE_OPTIONS)[number]["id"];
