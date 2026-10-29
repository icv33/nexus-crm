# Nexus CRM

CRM personal para una agencia de desarrollo web, con agentes de IA que buscan clientes, les escriben y hacen el seguimiento.

> Proyecto personal (abril de 2026). Copia limpia del código, sin historial ni datos.

## Qué hace

- **Prospección**: busca negocios en Google Maps, encuentra su correo y los mete como leads.
- **Pipeline**: de «nuevo» a «ganado» o «perdido», con semáforo de riesgo y columnas por fase.
- **Agentes de IA** (Claude): correo personalizado para cada lead, seguimientos automáticos, respuestas a quien contesta (siempre con aprobación manual), detección de respuestas negativas y automáticas, propuestas, copywriting e ideas de mejora.
- **Gmail y Google Calendar**: envía y lee los correos desde tu cuenta, seguimiento de aperturas, reuniones en el calendario y preparación de llamadas.
- **Gestión**: empresas, tareas, propuestas, proyectos, documentos (Supabase Storage), finanzas y ventas, con gráficos en el panel.
- **Chat con IA** sobre los datos del CRM y un resumen diario por correo.
- Límites para no hacer spam: tope diario de correos y envíos solo de 9 a 18 h.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 + Postgres (Supabase)
- NextAuth con Google (Gmail y Calendar por OAuth)
- Anthropic (Claude), Google Maps Places, Recharts

## Arrancarlo en local

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Crea un `.env.local` con:

```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
ANTHROPIC_API_KEY=
ADMIN_EMAIL=          # la única cuenta de Google que puede entrar
CRON_SECRET=
DAILY_EMAIL_LIMIT=50
AUTO_SEND_EMAILS=false
```

---

Hecho por [Ignacio Cabrera Villanova](https://www.linkedin.com/in/ignacio-cabrera-villanova) · Ahora construyendo [Birdeo](https://birdeo.app).
