# CLAUDE.md — Pilates SaaS

## Stack
Next.js 14 App Router · TypeScript estricto (sin `any`) · PostgreSQL (Neon) · Prisma ORM · NextAuth v5 · MercadoPago · Tailwind CSS · Vercel · Timezone: America/Argentina/Buenos_Aires

## Arquitectura multi-tenant
- Una sola DB compartida. **TODA tabla tiene `studioId`** — excepción: `studios` (es la raíz)
- El `studioId` siempre viene del contexto del servidor, NUNCA del body del cliente
- Subdominio → tenant: `centro-pilates.pilatesapp.com` → `studioId` via middleware
- Roles: `SUPER_ADMIN` (plataforma) · `STUDIO_ADMIN` (gestiona su estudio) · `INSTRUCTOR` (ve todas las clases del estudio, registra asistencia) · `STUDENT`

## Estructura de carpetas
```
/src/app/(landing)/         → landing page pública (registro, precios)
/src/app/[studio]/          → app del alumno y admin por tenant
/src/app/[studio]/admin/    → panel admin del estudio
/src/app/[studio]/onboarding/ → wizard de configuración inicial
/src/app/superadmin/        → panel Super Admin (solo SUPER_ADMIN)
/src/app/api/[studio]/      → API routes protegidas por estudio
/src/app/api/public/        → endpoints públicos (registro, check-slug)
/src/app/api/cron/          → generate-month, grace-cutoff, billing
/src/app/api/webhooks/      → mercadopago (alumnos), mp-saas (estudios)
/src/services/              → TODA la lógica de negocio aquí
  booking.service.ts        → reservas (el más crítico)
  credit.service.ts         → créditos y paquetes
  billing.service.ts        → suscripciones SaaS
  notification.service.ts   → email + WhatsApp unificado
  insights.service.ts       → IA con Claude API
/src/lib/prisma.ts          → cliente singleton
/src/lib/tenant.ts          → resolver studioId del subdominio
/src/lib/auth.ts            → config NextAuth
/src/types/errors.ts        → BookingError y demás tipos
```

## Reglas absolutas — nunca violar
1. **Toda query filtra por `studioId`** — si no, es un bug crítico de seguridad
2. **Nunca `.delete()`** en tablas de negocio — solo cambiar `status`
3. **Toda operación multi-tabla usa `$transaction()`**
4. **Emails y WhatsApp siempre fuera de la transacción** en try/catch separado
5. **`classesRemaining` nunca negativo** — CHECK constraint en DB
6. **Webhook MercadoPago siempre verifica idempotencia** antes de procesar
7. **Errors tipados** — usar `BookingError` de `/src/types/errors.ts`
8. **Endpoints públicos** (/api/public/*) nunca exponen datos internos ni stack traces

## Sistema de créditos — resumen
- FIFO por `expiresAt`: ORDER BY expiresAt ASC, sin filtrar vencidos (tienen saldo disponible)
- `userPackageId = null + status = CONFIRMED` = reserva en gracia (deuda)
- Al activar paquete: liquidar deuda pasada primero, luego vincular futuras

## Fases del proyecto
- **MVP**: reservas, créditos, pagos alumnos, cron, UX alumno, panel admin
- **Fase 1**: landing, registro de estudios, onboarding, billing SaaS, Super Admin
- **Fase 2**: branding por estudio, WhatsApp Twilio
- **Fase 3**: IA insights con Claude API

## Cuándo leer DATABASE.md
Adjuntarlo cuando la tarea toque: bookings · créditos · pagos · cron · gracia · cambio de plan · cancelación de sesión. Para UI, landing, branding o billing SaaS: no hace falta.

## Checklist rápido antes de entregar código
- [ ] ¿Toda query tiene `WHERE studioId`?
- [ ] ¿Hay `$transaction()` si toca más de una tabla?
- [ ] ¿Hay `FOR UPDATE` si toca bookings + créditos?
- [ ] ¿El email/WhatsApp va fuera de la transacción?
- [ ] ¿Se verificó idempotencia si es webhook?
