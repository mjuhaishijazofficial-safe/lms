-- AlterEnum
ALTER TYPE "MaterialType" ADD VALUE 'LESSON';

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "lessonData" JSONB;
