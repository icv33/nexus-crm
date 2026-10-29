import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client/index.js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Borrar en orden para respetar foreign keys
await prisma.actividad.deleteMany({})
await prisma.email.deleteMany({})
await prisma.tarea.deleteMany({})
await prisma.reunion.deleteMany({})
await prisma.propuesta.deleteMany({})
await prisma.lead.deleteMany({})

const total = await prisma.lead.count()
console.log(`Leads restantes: ${total} — hecho.`)
await prisma.$disconnect()
