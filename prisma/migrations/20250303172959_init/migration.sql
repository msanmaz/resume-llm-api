-- CreateTable
CREATE TABLE "enhancement_requests" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "context" JSONB,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "processingTimeMs" INTEGER,
    "ipAddress" TEXT,
    "source" TEXT,

    CONSTRAINT "enhancement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enhancement_results" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "enhancedContent" TEXT NOT NULL,
    "metadata" JSONB,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enhancement_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "averageProcessingTime" DOUBLE PRECISION,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enhancement_requests_correlationId_key" ON "enhancement_requests"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "enhancement_results_requestId_key" ON "enhancement_results"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_date_userId_key" ON "api_usage"("date", "userId");

-- AddForeignKey
ALTER TABLE "enhancement_results" ADD CONSTRAINT "enhancement_results_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "enhancement_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
