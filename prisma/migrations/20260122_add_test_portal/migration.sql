-- CreateEnum
CREATE TYPE "TesterStatus" AS ENUM ('INVITED', 'ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TesterLanguage" AS ENUM ('HU', 'EN');

-- CreateTable
CREATE TABLE "testers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "language" "TesterLanguage" NOT NULL DEFAULT 'HU',
    "status" "TesterStatus" NOT NULL DEFAULT 'INVITED',
    "current_phase" INTEGER NOT NULL DEFAULT 1,
    "total_phases" INTEGER NOT NULL DEFAULT 7,
    "last_login_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_feedback" (
    "id" TEXT NOT NULL,
    "tester_id" TEXT NOT NULL,
    "phase_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "screenshot_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_bug_reports" (
    "id" TEXT NOT NULL,
    "tester_id" TEXT NOT NULL,
    "phase_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "screenshot_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "testers_email_key" ON "testers"("email");

-- CreateIndex
CREATE INDEX "testers_email_idx" ON "testers"("email");

-- CreateIndex
CREATE INDEX "testers_status_idx" ON "testers"("status");

-- CreateIndex
CREATE INDEX "test_feedback_tester_id_idx" ON "test_feedback"("tester_id");

-- CreateIndex
CREATE INDEX "test_feedback_phase_id_idx" ON "test_feedback"("phase_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_feedback_tester_id_question_id_key" ON "test_feedback"("tester_id", "question_id");

-- CreateIndex
CREATE INDEX "test_bug_reports_tester_id_idx" ON "test_bug_reports"("tester_id");

-- CreateIndex
CREATE INDEX "test_bug_reports_status_idx" ON "test_bug_reports"("status");

-- CreateIndex
CREATE INDEX "test_bug_reports_severity_idx" ON "test_bug_reports"("severity");

-- AddForeignKey
ALTER TABLE "test_feedback" ADD CONSTRAINT "test_feedback_tester_id_fkey" FOREIGN KEY ("tester_id") REFERENCES "testers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_bug_reports" ADD CONSTRAINT "test_bug_reports_tester_id_fkey" FOREIGN KEY ("tester_id") REFERENCES "testers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
