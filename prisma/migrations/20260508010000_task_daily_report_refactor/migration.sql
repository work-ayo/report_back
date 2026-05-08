ALTER TYPE "TeamRole" ADD VALUE IF NOT EXISTS 'LEADER';

ALTER TABLE "Card" ADD COLUMN "taskId" VARCHAR(32);

CREATE TABLE "Task" (
  "taskId" VARCHAR(32) NOT NULL,
  "teamId" VARCHAR(32) NOT NULL,
  "projectId" VARCHAR(32),
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "parentTaskId" VARCHAR(32),
  "createdByUserId" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("taskId")
);

CREATE TABLE "DailyReport" (
  "dailyReportId" VARCHAR(32) NOT NULL,
  "teamId" VARCHAR(32) NOT NULL,
  "userId" VARCHAR(32) NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "summary" TEXT,
  "issue" TEXT,
  "plan" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("dailyReportId")
);

CREATE TABLE "DailyReportEntry" (
  "entryId" VARCHAR(32) NOT NULL,
  "dailyReportId" VARCHAR(32) NOT NULL,
  "taskId" VARCHAR(32),
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT,
  "minutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyReportEntry_pkey" PRIMARY KEY ("entryId")
);

CREATE UNIQUE INDEX "DailyReport_teamId_userId_workDate_key" ON "DailyReport"("teamId","userId","workDate");
CREATE INDEX "Task_teamId_idx" ON "Task"("teamId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX "Task_createdByUserId_idx" ON "Task"("createdByUserId");
CREATE INDEX "Card_taskId_idx" ON "Card"("taskId");
CREATE INDEX "DailyReport_teamId_workDate_idx" ON "DailyReport"("teamId","workDate");
CREATE INDEX "DailyReport_userId_workDate_idx" ON "DailyReport"("userId","workDate");
CREATE INDEX "DailyReportEntry_dailyReportId_idx" ON "DailyReportEntry"("dailyReportId");
CREATE INDEX "DailyReportEntry_taskId_idx" ON "DailyReportEntry"("taskId");

ALTER TABLE "Card" ADD CONSTRAINT "Card_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("taskId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("taskId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReportEntry" ADD CONSTRAINT "DailyReportEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("dailyReportId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReportEntry" ADD CONSTRAINT "DailyReportEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("taskId") ON DELETE SET NULL ON UPDATE CASCADE;
