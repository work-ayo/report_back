-- AlterTable
ALTER TABLE "Column" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "createdByUserId" VARCHAR(32);

-- CreateIndex
CREATE INDEX "Column_createdByUserId_idx" ON "Column"("createdByUserId");

-- CreateIndex
CREATE INDEX "Project_createdByUserId_idx" ON "Project"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
