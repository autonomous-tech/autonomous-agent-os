-- CreateTable
CREATE TABLE "McpServerConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "command" TEXT,
    "args" TEXT NOT NULL DEFAULT '[]',
    "url" TEXT,
    "env" TEXT NOT NULL DEFAULT '{}',
    "allowedTools" TEXT NOT NULL DEFAULT '[]',
    "blockedTools" TEXT NOT NULL DEFAULT '[]',
    "sandboxConfig" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpServerConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "deploymentId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "input" TEXT NOT NULL DEFAULT '{}',
    "output" TEXT NOT NULL DEFAULT '{}',
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolExecutionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ToolExecutionLog_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "mcpConfig" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deployment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deployment" ("agentId", "config", "createdAt", "id", "status", "systemPrompt", "updatedAt", "version") SELECT "agentId", "config", "createdAt", "id", "status", "systemPrompt", "updatedAt", "version" FROM "Deployment";
DROP TABLE "Deployment";
ALTER TABLE "new_Deployment" RENAME TO "Deployment";
CREATE INDEX "Deployment_agentId_idx" ON "Deployment"("agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "McpServerConfig_agentId_idx" ON "McpServerConfig"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "McpServerConfig_agentId_name_key" ON "McpServerConfig"("agentId", "name");

-- CreateIndex
CREATE INDEX "ToolExecutionLog_sessionId_idx" ON "ToolExecutionLog"("sessionId");

-- CreateIndex
CREATE INDEX "ToolExecutionLog_deploymentId_idx" ON "ToolExecutionLog"("deploymentId");

-- CreateIndex
CREATE INDEX "ToolExecutionLog_toolName_idx" ON "ToolExecutionLog"("toolName");
