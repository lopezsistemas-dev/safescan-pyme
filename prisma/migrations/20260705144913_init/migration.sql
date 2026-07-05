-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "policy" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "originalName" TEXT,
    "inputValue" TEXT,
    "filePath" TEXT,
    "sha256" TEXT,
    "mimeType" TEXT,
    "realType" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "progressStage" TEXT NOT NULL DEFAULT 'Recibido en cuarentena',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "threatScore" INTEGER,
    "sensitivityScore" INTEGER,
    "recommendedFlow" TEXT,
    "finalVerdict" TEXT,
    "providerUsed" TEXT,
    "privateScanningUsed" BOOLEAN NOT NULL DEFAULT false,
    "mockMode" BOOLEAN NOT NULL DEFAULT true,
    "employeeReport" TEXT,
    "adminReport" TEXT,
    "policyJson" TEXT,
    "tiJson" TEXT,
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "fileDeleted" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Analysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    CONSTRAINT "Indicator_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "analysisId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SafeDocsJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputFiles" TEXT NOT NULL,
    "outputFile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETADO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafeDocsJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SafeDocsJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");
