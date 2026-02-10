-- CreateTable
CREATE TABLE "AgentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" TEXT NOT NULL DEFAULT '{}',
    "stages" TEXT NOT NULL DEFAULT '{}',
    "conversations" TEXT NOT NULL DEFAULT '{}',
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "exportedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "stages" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProject_slug_key" ON "AgentProject"("slug");
