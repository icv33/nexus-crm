-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('nuevo', 'analizado', 'descartado', 'preparado_para_contactar', 'contactado', 'respondio', 'interesado', 'reunion_agendada', 'propuesta_pendiente', 'propuesta_enviada', 'negociacion', 'perdido', 'ganado');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('borrador', 'pendiente_aprobacion', 'enviada', 'aceptada', 'rechazada');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('onboarding', 'requisitos', 'construccion', 'revision', 'entrega', 'mantenimiento');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('activo', 'pausado', 'completado', 'cancelado');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pendiente', 'en_progreso', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('aprobacion', 'accion', 'revision', 'llamada', 'seguimiento');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('activo', 'pausado', 'error', 'inactivo');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('prospeccion', 'analista', 'email_generator', 'seguimiento', 'comercial', 'calendario', 'propuestas', 'requisitos', 'constructor', 'qa', 'resumen_diario');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('enviado', 'recibido');

-- CreateEnum
CREATE TYPE "EmailClassification" AS ENUM ('positivo', 'negativo', 'neutro', 'pregunta', 'interes', 'precio', 'no_clasificado');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('activa', 'pausada', 'completada', 'borrador');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('email_enviado', 'email_recibido', 'estado_cambiado', 'nota_agregada', 'reunion_agendada', 'propuesta_creada', 'tarea_creada', 'agente_ejecutado', 'lead_creado', 'proyecto_creado');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "password" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sector" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Zaragoza',
    "web" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "fuente" TEXT,
    "problemaDetectado" TEXT,
    "servicioRecomendado" TEXT,
    "puntuacion" INTEGER DEFAULT 5,
    "prioridad" "Priority" NOT NULL DEFAULT 'media',
    "estado" "LeadStatus" NOT NULL DEFAULT 'nuevo',
    "valorEstimado" DOUBLE PRECISION,
    "emailPreparado" TEXT,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3),
    "respuestaRecibida" BOOLEAN NOT NULL DEFAULT false,
    "resumenRespuesta" TEXT,
    "notas" TEXT,
    "proximaAccion" TEXT,
    "campaniaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ultimoContactoEn" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sector" TEXT,
    "ciudad" TEXT,
    "web" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "descripcion" TEXT,
    "empleados" INTEGER,
    "valorEstimado" DOUBLE PRECISION,
    "estadoComercial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campania" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudadObjetivo" TEXT NOT NULL DEFAULT 'Zaragoza',
    "sectorObjetivo" TEXT,
    "limiteDiarioEmails" INTEGER NOT NULL DEFAULT 5,
    "autoEnvio" BOOLEAN NOT NULL DEFAULT false,
    "estado" "CampaignStatus" NOT NULL DEFAULT 'borrador',
    "leadsGenerados" INTEGER NOT NULL DEFAULT 0,
    "emailsEnviados" INTEGER NOT NULL DEFAULT 0,
    "respuestasRecibidas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campania_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propuesta" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "servicioOfrecido" TEXT NOT NULL,
    "problemaDetectado" TEXT,
    "solucionPropuesta" TEXT,
    "precioEstimado" DOUBLE PRECISION,
    "plazoEstimado" TEXT,
    "estado" "ProposalStatus" NOT NULL DEFAULT 'borrador',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notas" TEXT,
    "fechaEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Propuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "leadId" TEXT,
    "empresaId" TEXT,
    "propuestaId" TEXT,
    "servicioVendido" TEXT NOT NULL,
    "etapa" "ProjectStage" NOT NULL DEFAULT 'onboarding',
    "estado" "ProjectStatus" NOT NULL DEFAULT 'activo',
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "fichaRequisitos" JSONB,
    "datosPendientes" TEXT,
    "entregables" JSONB,
    "bloqueos" TEXT,
    "valorTotal" DOUBLE PRECISION,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaEstimada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "prioridad" "Priority" NOT NULL DEFAULT 'media',
    "estado" "TaskStatus" NOT NULL DEFAULT 'pendiente',
    "tipo" "TaskType" NOT NULL DEFAULT 'accion',
    "vencimiento" TIMESTAMP(3),
    "origen" TEXT,
    "leadId" TEXT,
    "proyectoId" TEXT,
    "propuestaId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "AgentType" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "AgentStatus" NOT NULL DEFAULT 'inactivo',
    "ultimaEjecucion" TIMESTAMP(3),
    "configuracion" JSONB,
    "accionesPermitidas" JSONB,
    "accionesRequierenAprobacion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgenteLog" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'info',
    "mensaje" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgenteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "tipo" "EmailType" NOT NULL,
    "asunto" TEXT,
    "cuerpo" TEXT,
    "remitente" TEXT,
    "destinatario" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "clasificacion" "EmailClassification" NOT NULL DEFAULT 'no_clasificado',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reunion" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "googleEventId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "enlaceMeet" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'confirmada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "tipo" "ActivityType" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "metadata" JSONB,
    "leadId" TEXT,
    "proyectoId" TEXT,
    "agenteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'string',
    "descripcion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_propuestaId_key" ON "Proyecto"("propuestaId");

-- CreateIndex
CREATE UNIQUE INDEX "Agente_tipo_key" ON "Agente"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Email_gmailMessageId_key" ON "Email"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Reunion_googleEventId_key" ON "Reunion"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "Configuracion"("clave");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaniaId_fkey" FOREIGN KEY ("campaniaId") REFERENCES "Campania"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propuesta" ADD CONSTRAINT "Propuesta_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_propuestaId_fkey" FOREIGN KEY ("propuestaId") REFERENCES "Propuesta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgenteLog" ADD CONSTRAINT "AgenteLog_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Agente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reunion" ADD CONSTRAINT "Reunion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Agente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
