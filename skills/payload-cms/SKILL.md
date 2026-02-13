---
type: skill
name: payload-cms-integration
version: 1.0.0
tags: [cms, payload, nextjs, content-management]
---

# PayloadCMS Integration Patterns

This skill provides comprehensive patterns for integrating PayloadCMS with Next.js applications, covering configuration, collections, hooks, access control, and frontend integration.

## Overview

PayloadCMS is a headless CMS built with TypeScript, React, and MongoDB/Postgres. It provides:
- Fully type-safe APIs (REST + GraphQL)
- Rich admin UI out of the box
- Flexible content modeling with collections and globals
- Powerful hooks system for custom logic
- Built-in authentication and access control

**Typical use cases in Agent OS context:**
- Managing agent templates
- Storing project documentation
- User/team management
- Configuration storage with versioning

## Project Setup

### Installation

```bash
npm install payload @payloadcms/next @payloadcms/db-mongodb
npm install --save-dev @payloadcms/graphql
```

### Configuration (payload.config.ts)

```ts
import { buildConfig } from "payload/config";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";

export default buildConfig({
  // Admin UI configuration
  admin: {
    user: "users", // Collection used for admin auth
    meta: {
      titleSuffix: "- Agent OS CMS",
      favicon: "/favicon.ico",
    },
  },

  // Collections (content types)
  collections: [
    // Import collection configs here
  ],

  // Globals (singleton content)
  globals: [
    // Import global configs here
  ],

  // Database adapter
  db: mongooseAdapter({
    url: process.env.MONGODB_URI!,
  }),

  // Rich text editor
  editor: lexicalEditor({}),

  // TypeScript generation
  typescript: {
    outputFile: path.resolve(__dirname, "src/generated/payload-types.ts"),
  },

  // GraphQL endpoint
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, "src/generated/schema.graphql"),
  },

  // Server URL for emails, webhooks, etc.
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",

  // CORS settings
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"],

  // CSRF protection
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"],
});
```

### Next.js Integration (next.config.js)

```js
import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config
};

export default withPayload(nextConfig);
```

## Collection Patterns

### Basic Collection (Agent Templates)

```ts
// src/collections/AgentTemplates.ts
import { CollectionConfig } from "payload/types";

export const AgentTemplates: CollectionConfig = {
  slug: "agent-templates",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "category", "status", "updatedAt"],
  },
  access: {
    read: () => true, // Public read access
    create: ({ req: { user } }) => !!user, // Auth required for create
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 100,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly identifier",
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Auto-generate slug from name if not provided
            if (!value && data?.name) {
              return data.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            }
            return value;
          },
        ],
      },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      maxLength: 500,
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Customer Support", value: "customer-support" },
        { label: "Content Creation", value: "content-creation" },
        { label: "Data Analysis", value: "data-analysis" },
        { label: "Development", value: "development" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Archived", value: "archived" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "config",
      type: "json",
      required: true,
      admin: {
        description: "Full agent configuration (AgentConfig type)",
      },
    },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Preview image for the template",
      },
    },
    {
      name: "tags",
      type: "array",
      fields: [
        {
          name: "tag",
          type: "text",
          required: true,
        },
      ],
      admin: {
        description: "Searchable tags for filtering",
      },
    },
  ],
  timestamps: true, // Adds createdAt and updatedAt
};
```

### Relationship Fields

```ts
// Project collection with relationships
export const Projects: CollectionConfig = {
  slug: "projects",
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "owner",
      type: "relationship",
      relationTo: "users",
      required: true,
      hasMany: false,
    },
    {
      name: "team",
      type: "relationship",
      relationTo: "users",
      hasMany: true, // Array of user IDs
    },
    {
      name: "templates",
      type: "relationship",
      relationTo: "agent-templates",
      hasMany: true,
      admin: {
        description: "Agent templates used in this project",
      },
    },
  ],
};
```

### Rich Text Fields

```ts
import { lexicalEditor } from "@payloadcms/richtext-lexical";

export const Documentation: CollectionConfig = {
  slug: "documentation",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          // Add custom features here
        ],
      }),
    },
  ],
};
```

## Access Control Patterns

### Role-Based Access

```ts
import { Access } from "payload/types";

// Only admins can delete
const isAdmin: Access = ({ req: { user } }) => {
  return user?.role === "admin";
};

// Users can only edit their own content
const isOwnerOrAdmin: Access = ({ req: { user } }) => {
  if (user?.role === "admin") return true;

  return {
    owner: {
      equals: user?.id,
    },
  };
};

export const Projects: CollectionConfig = {
  slug: "projects",
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: isOwnerOrAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "owner",
      type: "relationship",
      relationTo: "users",
      required: true,
      defaultValue: ({ user }) => user?.id, // Auto-set to current user
    },
    // ... other fields
  ],
};
```

### Field-Level Access

```ts
export const Users: CollectionConfig = {
  slug: "users",
  auth: true, // Enable authentication
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "user",
      options: ["admin", "editor", "user"],
      access: {
        // Only admins can change roles
        update: ({ req: { user } }) => user?.role === "admin",
      },
    },
    {
      name: "apiKey",
      type: "text",
      admin: {
        description: "API key for programmatic access",
      },
      access: {
        // Users can read their own API key, admins can read all
        read: ({ req: { user }, doc }) => {
          if (user?.role === "admin") return true;
          return user?.id === doc?.id;
        },
      },
    },
  ],
};
```

## Hooks System

### Before Validate Hook

```ts
export const AgentTemplates: CollectionConfig = {
  slug: "agent-templates",
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        // Auto-increment version on update
        if (operation === "update" && data.version) {
          data.version = (data.version as number) + 1;
        }

        return data;
      },
    ],
  },
  fields: [
    {
      name: "version",
      type: "number",
      required: true,
      defaultValue: 1,
      admin: {
        readOnly: true,
      },
    },
    // ... other fields
  ],
};
```

### After Change Hook (for Side Effects)

```ts
export const Projects: CollectionConfig = {
  slug: "projects",
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        // Send notification when project is published
        if (operation === "update" && doc.status === "published") {
          await sendNotification({
            userId: doc.owner,
            message: `Your project "${doc.name}" has been published!`,
          });
        }
      },
    ],
  },
};
```

### Before Delete Hook (Validation)

```ts
export const AgentTemplates: CollectionConfig = {
  slug: "agent-templates",
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // Prevent deletion if template is in use
        const projects = await req.payload.find({
          collection: "projects",
          where: {
            templates: {
              contains: id,
            },
          },
          limit: 1,
        });

        if (projects.docs.length > 0) {
          throw new Error(
            "Cannot delete template that is used in active projects"
          );
        }
      },
    ],
  },
};
```

## Frontend Integration

### Server-Side Data Fetching

```tsx
// src/app/templates/page.tsx
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@/payload.config";

export default async function TemplatesPage() {
  const payload = await getPayloadHMR({ config: configPromise });

  const templates = await payload.find({
    collection: "agent-templates",
    where: {
      status: {
        equals: "published",
      },
    },
    sort: "-createdAt",
    limit: 20,
  });

  return (
    <div>
      <h1>Agent Templates</h1>
      {templates.docs.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}
```

### Client-Side API Calls

```tsx
// src/components/TemplateSearch.tsx
"use client";

import { useState } from "react";

export function TemplateSearch() {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");

  async function handleSearch(searchQuery: string) {
    const res = await fetch(
      `/api/agent-templates?where[name][like]=${encodeURIComponent(searchQuery)}`
    );

    const data = await res.json();
    setResults(data.docs);
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        placeholder="Search templates..."
      />
      {/* Render results */}
    </div>
  );
}
```

### REST API Endpoints

Payload auto-generates REST endpoints:

```
GET    /api/agent-templates        - List all templates
GET    /api/agent-templates/:id    - Get single template
POST   /api/agent-templates        - Create template
PATCH  /api/agent-templates/:id    - Update template
DELETE /api/agent-templates/:id    - Delete template
```

**Query parameters:**
- `where[field][operator]=value` - Filtering
- `sort=field` or `sort=-field` - Sorting (- for descending)
- `limit=20` - Pagination limit
- `page=1` - Page number
- `depth=2` - Relationship depth (0-10)

Example:
```
/api/agent-templates?where[category][equals]=customer-support&sort=-createdAt&limit=10
```

### GraphQL Integration

```tsx
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@/payload.config";

export async function getTemplateBySlug(slug: string) {
  const payload = await getPayloadHMR({ config: configPromise });

  const query = `
    query GetTemplate($slug: String!) {
      AgentTemplates(where: { slug: { equals: $slug } }) {
        docs {
          id
          name
          description
          config
          category
          thumbnail {
            url
            alt
          }
        }
      }
    }
  `;

  const result = await payload.graphQL.execute({
    query,
    variables: { slug },
  });

  return result.data?.AgentTemplates?.docs?.[0];
}
```

## Global Configuration

Globals are singleton content types (e.g., site settings, feature flags).

```ts
// src/globals/SiteSettings.ts
import { GlobalConfig } from "payload/types";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  admin: {
    description: "Global site configuration",
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      required: true,
      defaultValue: "Agent OS",
    },
    {
      name: "maintenanceMode",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Enable to show maintenance page to non-admin users",
      },
    },
    {
      name: "maxAgentsPerUser",
      type: "number",
      required: true,
      defaultValue: 10,
      min: 1,
      max: 100,
    },
    {
      name: "featuredTemplates",
      type: "relationship",
      relationTo: "agent-templates",
      hasMany: true,
      maxRows: 6,
      admin: {
        description: "Templates to show on the homepage",
      },
    },
  ],
};

// Fetch in frontend
const payload = await getPayloadHMR({ config: configPromise });
const settings = await payload.findGlobal({ slug: "site-settings" });
```

## File Uploads

```ts
// src/collections/Media.ts
export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    staticDir: "public/media", // Upload directory
    mimeTypes: ["image/*", "application/pdf"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 300,
        position: "centre",
      },
      {
        name: "card",
        width: 768,
        height: 512,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
    },
  ],
};

// Use in other collections
{
  name: "thumbnail",
  type: "upload",
  relationTo: "media",
  required: true,
}
```

## Custom Endpoints

```ts
// src/collections/AgentTemplates.ts
export const AgentTemplates: CollectionConfig = {
  slug: "agent-templates",
  endpoints: [
    {
      path: "/clone/:id",
      method: "post",
      handler: async (req, res) => {
        const { id } = req.params;
        const original = await req.payload.findByID({
          collection: "agent-templates",
          id,
        });

        if (!original) {
          return res.status(404).json({ error: "Template not found" });
        }

        const cloned = await req.payload.create({
          collection: "agent-templates",
          data: {
            ...original,
            name: `${original.name} (Copy)`,
            slug: `${original.slug}-copy-${Date.now()}`,
            status: "draft",
          },
        });

        return res.status(201).json(cloned);
      },
    },
  ],
};

// Call from frontend
const res = await fetch("/api/agent-templates/clone/abc123", {
  method: "POST",
});
```

## TypeScript Types

Payload auto-generates TypeScript types:

```ts
// src/generated/payload-types.ts (auto-generated)
export interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: "customer-support" | "content-creation" | "data-analysis" | "development";
  status: "draft" | "published" | "archived";
  config: AgentConfig;
  thumbnail?: string | Media;
  tags?: { tag: string }[];
  createdAt: string;
  updatedAt: string;
}

// Use in your code
import type { AgentTemplate } from "@/generated/payload-types";

function TemplateCard({ template }: { template: AgentTemplate }) {
  return <div>{template.name}</div>;
}
```

## Best Practices

### 1. Use Slugs for Public URLs
Always include a unique `slug` field for URL routing:
```
/templates/customer-support-agent (slug)
Not: /templates/507f1f77bcf86cd799439011 (ID)
```

### 2. Implement Soft Deletes
Add a `status` or `archived` field instead of hard deletes:
```ts
{
  name: "archived",
  type: "checkbox",
  defaultValue: false,
  admin: {
    position: "sidebar",
  },
}
```

### 3. Version Control for Critical Content
```ts
{
  name: "version",
  type: "number",
  required: true,
  defaultValue: 1,
  admin: {
    readOnly: true,
  },
}
```

### 4. Use Relationships Wisely
- `hasMany: false` for 1-to-1 relationships
- `hasMany: true` for 1-to-many relationships
- Set `depth: 0` in queries if you only need IDs (performance)

### 5. Optimize Queries
```ts
// Bad: Fetches all fields and populates all relationships
const templates = await payload.find({ collection: "agent-templates" });

// Good: Select only needed fields, limit depth
const templates = await payload.find({
  collection: "agent-templates",
  select: { name: true, slug: true, thumbnail: true },
  depth: 0, // Don't populate relationships
  limit: 20,
});
```

---

**Last Updated**: 2026-02-13
**Payload Version**: 3.x
**Reference**: https://payloadcms.com/docs
