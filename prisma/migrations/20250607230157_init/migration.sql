-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "defaultEntryTime" TIME NOT NULL DEFAULT '06:30:00'::time,
    "defaultExitTime" TIME NOT NULL DEFAULT '16:00:00'::time,
    "defaultLunchDuration" INTEGER NOT NULL DEFAULT 30,
    "defaultWorkingHours" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "identification" VARCHAR(20) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "areaId" TEXT,
    "position" VARCHAR(100),
    "baseSalary" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TIME,
    "exitTime" TIME,
    "lunchDuration" INTEGER,
    "workedHours" DECIMAL(4,2),
    "isVacation" BOOLEAN NOT NULL DEFAULT false,
    "permissionHours" DECIMAL(4,2) DEFAULT 0,
    "permissionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_allowances" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "breakfast" INTEGER NOT NULL DEFAULT 0,
    "reinforcedBreakfast" INTEGER NOT NULL DEFAULT 0,
    "snack1" INTEGER NOT NULL DEFAULT 0,
    "afternoonSnack" INTEGER NOT NULL DEFAULT 0,
    "dryMeal" INTEGER NOT NULL DEFAULT 0,
    "lunch" INTEGER NOT NULL DEFAULT 0,
    "transport" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extra_hours" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "nightHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "supplementaryHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "extraordinaryHours" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summaries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalWorkedHours" DECIMAL(6,2),
    "totalNightHours" DECIMAL(6,2),
    "totalSupplementaryHours" DECIMAL(6,2),
    "totalExtraordinaryHours" DECIMAL(6,2),
    "totalBreakfast" INTEGER,
    "totalReinforcedBreakfast" INTEGER,
    "totalSnack1" INTEGER,
    "totalAfternoonSnack" INTEGER,
    "totalDryMeal" INTEGER,
    "totalLunch" INTEGER,
    "totalTransport" DECIMAL(8,2),
    "totalPermissions" DECIMAL(6,2),
    "vacationDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "areas_name_key" ON "areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_identification_key" ON "employees"("identification");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_date_key" ON "attendance_records"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "food_allowances_attendanceId_key" ON "food_allowances"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "extra_hours_attendanceId_key" ON "extra_hours"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_summaries_employeeId_periodStart_periodEnd_key" ON "monthly_summaries"("employeeId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_allowances" ADD CONSTRAINT "food_allowances_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_hours" ADD CONSTRAINT "extra_hours_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_summaries" ADD CONSTRAINT "monthly_summaries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
