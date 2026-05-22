-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "assigneeUserId" VARCHAR(32),
ADD COLUMN     "parentCardId" VARCHAR(32),
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Card_assigneeUserId_idx" ON "Card"("assigneeUserId");

-- CreateIndex
CREATE INDEX "Card_parentCardId_idx" ON "Card"("parentCardId");

-- CreateIndex
CREATE INDEX "Card_startDate_idx" ON "Card"("startDate");

-- CreateIndex
CREATE INDEX "Card_dueDate_idx" ON "Card"("dueDate");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_parentCardId_fkey" FOREIGN KEY ("parentCardId") REFERENCES "Card"("cardId") ON DELETE SET NULL ON UPDATE CASCADE;
