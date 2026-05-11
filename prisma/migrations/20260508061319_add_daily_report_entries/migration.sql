-- CreateTable
CREATE TABLE "DailyReportEntry" (
    "dailyReportEntryId" VARCHAR(32) NOT NULL,
    "teamId" VARCHAR(32) NOT NULL,
    "userId" VARCHAR(32) NOT NULL,
    "projectId" VARCHAR(32),
    "reportDate" TIMESTAMP(3) NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportEntry_pkey" PRIMARY KEY ("dailyReportEntryId")
);

-- CreateIndex
CREATE INDEX "DailyReportEntry_teamId_reportDate_idx" ON "DailyReportEntry"("teamId", "reportDate");

-- CreateIndex
CREATE INDEX "DailyReportEntry_userId_reportDate_idx" ON "DailyReportEntry"("userId", "reportDate");

-- CreateIndex
CREATE INDEX "DailyReportEntry_projectId_idx" ON "DailyReportEntry"("projectId");

-- AddForeignKey
ALTER TABLE "DailyReportEntry" ADD CONSTRAINT "DailyReportEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportEntry" ADD CONSTRAINT "DailyReportEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportEntry" ADD CONSTRAINT "DailyReportEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
