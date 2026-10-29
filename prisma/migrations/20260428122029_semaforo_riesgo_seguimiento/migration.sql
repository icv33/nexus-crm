-- CreateEnum
CREATE TYPE "Semaforo" AS ENUM ('verde', 'amarillo', 'rojo');

-- CreateEnum
CREATE TYPE "RiesgoComercial" AS ENUM ('bajo', 'medio', 'alto');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'semaforo_cambiado';
ALTER TYPE "ActivityType" ADD VALUE 'riesgo_detectado';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'seguimiento_1';
ALTER TYPE "LeadStatus" ADD VALUE 'seguimiento_2';
ALTER TYPE "LeadStatus" ADD VALUE 'seguimiento_3';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "clasificacionRespuesta" "EmailClassification",
ADD COLUMN     "riesgoComercial" "RiesgoComercial" NOT NULL DEFAULT 'bajo',
ADD COLUMN     "seguimientoCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "semaforo" "Semaforo" NOT NULL DEFAULT 'verde';
