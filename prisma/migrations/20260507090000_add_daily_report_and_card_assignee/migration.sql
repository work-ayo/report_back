-- AlterTable
ALTER TABLE "Card" ADD COLUMN "assigneeUserId" VARCHAR(32);

-- CreateTable
CREATE TABLE "DailyReport" (
  "dailyReportId" VARCHAR(32) NOT NULL,
  "teamId" VARCHAR(32) NOT NULL,
  "userId" VARCHAR(32) NOT NULL,
  "cardId" VARCHAR(32),
  "workedAt" TIMESTAMP(3) NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("dailyReportId")
);

CREATE INDEX "Card_assigneeUserId_idx" ON "Card"("assigneeUserId");
CREATE INDEX "DailyReport_teamId_workedAt_idx" ON "DailyReport"("teamId", "workedAt");
CREATE INDEX "DailyReport_userId_workedAt_idx" ON "DailyReport"("userId", "workedAt");

ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("teamId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("cardId") ON DELETE SET NULL ON UPDATE CASCADE;
