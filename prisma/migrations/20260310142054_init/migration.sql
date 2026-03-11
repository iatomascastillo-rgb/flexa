-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'STUDIO_ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MERCADOPAGO', 'TRANSFER', 'CASH', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'WAITLIST');

-- CreateEnum
CREATE TYPE "BookingOrigin" AS ENUM ('RECURRING', 'MANUAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'BOOKING_DEDUCT', 'CANCELLATION_REFUND', 'GRACE_DEBT_SETTLEMENT', 'PLAN_CHANGE_DEDUCT', 'PLAN_CHANGE_TRANSFER', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LateCancellationPolicy" AS ENUM ('LOSE_CREDIT', 'KEEP_CREDIT');

-- CreateEnum
CREATE TYPE "NoShowPolicy" AS ENUM ('LOSE_CREDIT', 'KEEP_CREDIT');

-- CreateEnum
CREATE TYPE "GraceOnNoPay" AS ENUM ('RELEASE_TO_WAITLIST', 'KEEP_AND_ALERT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'TRIAL_EXPIRED', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASICO', 'PRO');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "studios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_settings" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "cancellationHours" INTEGER NOT NULL DEFAULT 12,
    "lateCancellationPolicy" "LateCancellationPolicy" NOT NULL DEFAULT 'LOSE_CREDIT',
    "noShowPolicy" "NoShowPolicy" NOT NULL DEFAULT 'LOSE_CREDIT',
    "allowWaitlist" BOOLEAN NOT NULL DEFAULT true,
    "bookingWindowHours" INTEGER NOT NULL DEFAULT 1,
    "generationDayOfMonth" INTEGER NOT NULL DEFAULT 25,
    "waitlistAutoPromote" BOOLEAN NOT NULL DEFAULT true,
    "gracePeriodEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodCutoffDay" INTEGER NOT NULL DEFAULT 10,
    "graceRequiresHistory" BOOLEAN NOT NULL DEFAULT true,
    "graceOnNoPay" "GraceOnNoPay" NOT NULL DEFAULT 'RELEASE_TO_WAITLIST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_branding" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "welcomeMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASICO',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsappOptOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_types" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "defaultCapacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "classTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "capacityOverride" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_packages" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentId" TEXT,
    "classesTotal" INTEGER NOT NULL,
    "classesRemaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "userPackageId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "origin" "BookingOrigin" NOT NULL DEFAULT 'MANUAL',
    "attendanceStatus" "AttendanceStatus",
    "creditRefunded" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_schedules" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classTypeId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "time" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userPackageId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studios_slug_key" ON "studios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "studio_settings_studioId_key" ON "studio_settings"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "studio_branding_studioId_key" ON "studio_branding"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_studioId_key" ON "subscriptions"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_studioId_key" ON "users"("email", "studioId");

-- CreateIndex
CREATE INDEX "class_sessions_studioId_date_idx" ON "class_sessions"("studioId", "date");

-- CreateIndex
CREATE INDEX "class_sessions_studioId_classTypeId_date_idx" ON "class_sessions"("studioId", "classTypeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_studioId_date_time_classTypeId_key" ON "class_sessions"("studioId", "date", "time", "classTypeId");

-- CreateIndex
CREATE INDEX "user_packages_studioId_userId_expiresAt_idx" ON "user_packages"("studioId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "user_packages_studioId_paymentStatus_idx" ON "user_packages"("studioId", "paymentStatus");

-- CreateIndex
CREATE INDEX "user_packages_studioId_userId_paymentStatus_idx" ON "user_packages"("studioId", "userId", "paymentStatus");

-- CreateIndex
CREATE INDEX "user_packages_studioId_paymentId_idx" ON "user_packages"("studioId", "paymentId");

-- CreateIndex
CREATE INDEX "bookings_studioId_classSessionId_status_idx" ON "bookings"("studioId", "classSessionId", "status");

-- CreateIndex
CREATE INDEX "bookings_studioId_userId_status_idx" ON "bookings"("studioId", "userId", "status");

-- CreateIndex
CREATE INDEX "bookings_studioId_userPackageId_idx" ON "bookings"("studioId", "userPackageId");

-- CreateIndex
CREATE INDEX "bookings_studioId_userId_userPackageId_idx" ON "bookings"("studioId", "userId", "userPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_userId_classSessionId_key" ON "bookings"("userId", "classSessionId");

-- CreateIndex
CREATE INDEX "recurring_schedules_studioId_userId_active_idx" ON "recurring_schedules"("studioId", "userId", "active");

-- CreateIndex
CREATE INDEX "recurring_schedules_studioId_dayOfWeek_time_idx" ON "recurring_schedules"("studioId", "dayOfWeek", "time");

-- CreateIndex
CREATE INDEX "credit_transactions_studioId_userPackageId_idx" ON "credit_transactions"("studioId", "userPackageId");

-- CreateIndex
CREATE INDEX "credit_transactions_studioId_createdAt_idx" ON "credit_transactions"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_studioId_createdAt_idx" ON "audit_logs"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_studioId_userId_idx" ON "audit_logs"("studioId", "userId");

-- CreateIndex
CREATE INDEX "platform_events_studioId_createdAt_idx" ON "platform_events"("studioId", "createdAt");

-- AddForeignKey
ALTER TABLE "studio_settings" ADD CONSTRAINT "studio_settings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_branding" ADD CONSTRAINT "studio_branding_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_types" ADD CONSTRAINT "class_types_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "class_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userPackageId_fkey" FOREIGN KEY ("userPackageId") REFERENCES "user_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "class_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userPackageId_fkey" FOREIGN KEY ("userPackageId") REFERENCES "user_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
