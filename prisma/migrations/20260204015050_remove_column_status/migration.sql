/*
  Warnings:

  - You are about to drop the column `status` on the `Column` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Column" DROP COLUMN "status";

-- DropEnum
DROP TYPE "ColumnStatus";
