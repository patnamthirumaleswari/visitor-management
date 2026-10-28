-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('admin', 'receptionist', 'host', 'security');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('expected', 'pending', 'review', 'signed_in', 'denied', 'checkout', 'gate', 'hold', 'signed_out');

-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('qr', 'kiosk', 'portal');

-- CreateEnum
CREATE TYPE "SignOutBy" AS ENUM ('badge', 'kiosk', 'portal', 'auto', 'gate');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('arrival', 'invitation', 'approval', 'escalation', 'checkout', 'hold', 'watchlist');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('logged', 'sent', 'failed');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "hostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "notifyBy" TEXT[] DEFAULT ARRAY['email']::TEXT[],
    "pinHash" TEXT,
    "pinFailures" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "qrToken" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "photo" TEXT,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "visitorTypeId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "status" "VisitStatus" NOT NULL,
    "source" "VisitSource" NOT NULL,
    "expectedDate" TEXT,
    "no" INTEGER,
    "code" TEXT,
    "badgeToken" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "signedInAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "checkoutRequestedAt" TIMESTAMP(3),
    "checkoutEscalated" BOOLEAN NOT NULL DEFAULT false,
    "checkoutNote" TEXT,
    "holdReason" TEXT,
    "holdBy" TEXT,
    "holdAt" TIMESTAMP(3),
    "watchName" TEXT,
    "watchReason" TEXT,
    "signedOutAt" TIMESTAMP(3),
    "signedOutBy" "SignOutBy",
    "agreementVersion" TEXT,
    "signature" TEXT,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "safetyVersion" INTEGER,
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "event" TEXT NOT NULL,
    "by" TEXT NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UsedSession" (
    "nonce" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedSession_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "visitId" TEXT NOT NULL,
    "hostId" TEXT,
    "to" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId","staffUserId")
);

-- CreateTable
CREATE TABLE "EmployeeVisit" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "signedInAt" TIMESTAMP(3) NOT NULL,
    "signedOutAt" TIMESTAMP(3),
    "signedOutBy" TEXT,

    CONSTRAINT "EmployeeVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorType" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "photoRequired" BOOLEAN NOT NULL DEFAULT true,
    "agreementRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VisitorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branding" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "companyName" TEXT,
    "welcomeText" TEXT,
    "primaryColor" TEXT,
    "logo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyBriefing" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "emergencyPhone" TEXT NOT NULL,
    "assemblyPoint" TEXT NOT NULL,
    "notes" TEXT[],
    "rules" JSONB NOT NULL DEFAULT '[]',
    "exitPlan" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "escalateMinutes" INTEGER,
    "autoSignoutTime" TEXT,
    "retentionDays" INTEGER,
    "lastVisitNo" INTEGER,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_username_key" ON "StaffUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_hostId_key" ON "StaffUser"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "Host_qrToken_key" ON "Host"("qrToken");

-- CreateIndex
CREATE INDEX "Host_name_idx" ON "Host"("name");

-- CreateIndex
CREATE INDEX "Visitor_phone_idx" ON "Visitor"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_badgeToken_key" ON "Visit"("badgeToken");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_hostId_status_idx" ON "Visit"("hostId", "status");

-- CreateIndex
CREATE INDEX "Visit_checkedInAt_idx" ON "Visit"("checkedInAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_visitId_at_idx" ON "TimelineEvent"("visitId", "at");

-- CreateIndex
CREATE INDEX "TimelineEvent_at_idx" ON "TimelineEvent"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_visitId_key" ON "Invitation"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_qrToken_key" ON "Invitation"("qrToken");

-- CreateIndex
CREATE INDEX "Notification_hostId_sentAt_idx" ON "Notification"("hostId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_kind_sentAt_idx" ON "Notification"("kind", "sentAt");

-- CreateIndex
CREATE INDEX "EmployeeVisit_hostId_signedOutAt_idx" ON "EmployeeVisit"("hostId", "signedOutAt");

-- CreateIndex
CREATE INDEX "WatchEntry_phone_idx" ON "WatchEntry"("phone");

-- CreateIndex
CREATE INDEX "AuditEntry_at_idx" ON "AuditEntry"("at");

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitorTypeId_fkey" FOREIGN KEY ("visitorTypeId") REFERENCES "VisitorType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeVisit" ADD CONSTRAINT "EmployeeVisit_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;
