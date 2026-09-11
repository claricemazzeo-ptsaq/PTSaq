-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "conflictAt" TIMESTAMP(3),
ADD COLUMN     "conflictSheetStatus" "TaskStatus";
