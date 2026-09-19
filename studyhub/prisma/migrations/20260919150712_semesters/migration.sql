-- DropIndex
DROP INDEX "Enrollment_courseId_idx";

-- DropIndex
DROP INDEX "Subject_courseId_status_order_idx";

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "semesterId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "semesterId" TEXT;

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Semester_courseId_order_idx" ON "Semester"("courseId", "order");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_semesterId_idx" ON "Enrollment"("courseId", "semesterId");

-- CreateIndex
CREATE INDEX "Subject_courseId_semesterId_status_order_idx" ON "Subject"("courseId", "semesterId", "status", "order");

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
