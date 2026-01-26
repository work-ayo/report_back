-- AlterTable
ALTER TABLE "WeeklyReport" ADD COLUMN     "issue" TEXT,
ADD COLUMN     "solution" TEXT;

-- CreateIndex
CREATE INDEX "WeeklyReport_teamId_weekStart_idx" ON "WeeklyReport"("teamId", "weekStart");
