# /prompt — Prompts listos para cada sesión de desarrollo

Cuando el usuario invoca /prompt [nombre], devolvé el prompt exacto para copiar y pegar en VS Code.

---

## /prompt schema
```
Leé CLAUDE.md y DATABASE.md.
Creá el schema.prisma completo con todas las tablas, enums, relaciones, 
índices (@@index) y constraints @@unique definidos en DATABASE.md.

Antes de entregarme el código, confirmá mentalmente:
- Toda tabla tiene studioId (excepto studios)
- Los @@unique están todos presentes
- Los @@index están todos presentes
- Los enums coinciden exactamente

Al final del schema agregá este comentario para la migración manual:
-- MIGRATION: ALTER TABLE user_packages ADD CONSTRAINT classes_remaining_non_negative CHECK (classes_remaining >= 0);
```

---

## /prompt auth
```
Leé CLAUDE.md.
Implementá la autenticación completa:
1. /src/lib/auth.ts — NextAuth v5 con PrismaAdapter, credenciales email/password, JWT con role y studioId
2. /src/lib/tenant.ts — getTenant() que resuelve el studioId desde el subdominio del request
3. /src/middleware.ts — protege /admin/* para STUDIO_ADMIN y SUPER_ADMIN, /superadmin/* solo SUPER_ADMIN, redirige al login si no hay sesión
```

---

## /prompt booking
```
Leé CLAUDE.md y DATABASE.md.
Implementá /src/services/booking.service.ts con createBooking siguiendo EXACTAMENTE el Flujo 1 del DATABASE.md.
Requisitos críticos:
- FOR UPDATE en ClassSession
- 7 validaciones en orden antes de crear la reserva
- FIFO: ORDER BY expiresAt ASC, sin filtrar por expiresAt
- CreditTransaction si se descontó crédito
- Booking con userPackageId=null si aplica gracia
- AuditLog al final
- Email en try/catch FUERA de la transacción
Al terminar ejecutá /validate.
```

---

## /prompt cancel
```
Leé CLAUDE.md y DATABASE.md.
Implementá en /src/services/booking.service.ts:
1. cancelBooking — Flujo 2: diferencia WAITLIST vs CONFIRMED, ventana de cancelación, gracia (creditRefunded=false siempre)
2. promoteFromWaitlist — Flujo 3: candidatos en orden, saltear sin créditos ni gracia, notificar
3. cancelSession — Flujo 4: afecta CONFIRMED (con y sin crédito) + WAITLIST, devuelve crédito solo a los que tenían userPackageId != null
Al terminar ejecutá /validate.
```

---

## /prompt webhook
```
Leé CLAUDE.md y DATABASE.md.
Implementá /src/app/api/webhooks/mercadopago/route.ts siguiendo el Flujo 5.
CRÍTICO: verificar idempotencia por paymentId antes de cualquier operación.
Incluir activación de paquete con liquidación de gracia completa.
Al terminar ejecutá /validate.
```

---

## /prompt cron
```
Leé CLAUDE.md y DATABASE.md.
Implementá:
1. POST /api/cron/generate-month — protegido con CRON_SECRET, re-ejecutable con upsert, Flujo 7
2. POST /api/cron/grace-cutoff — día 10, RELEASE_TO_WAITLIST o KEEP_AND_ALERT según config del estudio
Configurar en cron-job.org con header: Authorization: Bearer {CRON_SECRET}
```

---

## /prompt home
```
Leé CLAUDE.md y /screen.
Pantalla Home del alumno como Server Component mobile-first:
1. Créditos disponibles — número grande (Cormorant Garamond), barra de progreso sage, vencimiento del paquete
2. Alerta si hay reservas en gracia sin pagar
3. Próximas clases — scroll horizontal, opción de cancelar si hay anticipación suficiente
4. Plan activo con estado de pago
5. Nav inferior fija: Inicio · Clases · Recurrencia · Perfil
Colores: cream #F7F3EE fondo, sage #5C7A5E principal, terracotta #C4774A alertas.
```

---

## /prompt admin-manual
```
Leé CLAUDE.md y DATABASE.md.
Implementá asignación manual de créditos (Flujo 6):
1. /src/services/credit.service.ts → adminAdjustCredits con todas las validaciones
2. Si no tiene paquete activo: crear UserPackage ADMIN_GRANT con packageId=null
3. CreditTransaction ADMIN_ADJUSTMENT con note obligatorio
4. AuditLog con before/after
5. /src/app/api/[studio]/admin/credits/route.ts
6. UI en el perfil del alumno (vista admin): campo cantidad, campo motivo requerido
```

---

## /prompt registro-estudio
```
Leé CLAUDE.md.
Implementá el registro público de nuevos estudios:
1. POST /src/app/api/public/studios/register/route.ts
   Validaciones: email único, slug disponible, slug no en lista negra
   Lista negra de slugs: ["www","api","app","admin","login","logout","registro","onboarding","soporte","support","superadmin"]
   $transaction: User(STUDIO_ADMIN) + Studio + StudioSettings + StudioBranding + Subscription(TRIAL, +14 días)
   POST-transacción: email de bienvenida, notificación al Super Admin
2. /src/app/(landing)/registro/page.tsx — formulario de 2 pasos
   Paso 1: nombre, email, contraseña, teléfono
   Paso 2: nombre del estudio, slug (con validación en tiempo real via /api/public/check-slug)
3. GET /api/public/check-slug?slug=xxx — devuelve { available: boolean }
```

---

## /prompt onboarding
```
Leé CLAUDE.md.
Implementá el wizard de onboarding en /src/app/[studio]/onboarding/:
- Layout con barra de progreso (6 pasos)
- Paso 1: datos del estudio (nombre, descripción, ciudad, teléfono, horario de atención)
- Paso 2: tipos de clase (nombre, capacidad, nivel — al menos 1)
- Paso 3: horarios disponibles (días de semana + horas)
- Paso 4: paquetes y precios (nombre, cantidad de clases, precio en ARS — al menos 1)
- Paso 5: configurar MercadoPago (opcional — publicKey + secretKey, validar con MP)
- Paso 6: invitar primeros alumnos (email, opcional)
- Redirigir a /admin/dashboard al completar o al hacer clic en "Completar después"
Solo accesible para STUDIO_ADMIN. Si ya completó el onboarding: redirigir al dashboard.
```

---

## /prompt billing-cron
```
Leé CLAUDE.md.
Implementá POST /api/cron/billing protegido con CRON_SECRET.
Lógica completa:
- TRIAL + trialEndsAt == hoy → TRIAL_EXPIRED + email "trial vencido"
- TRIAL_EXPIRED + 1 día → email "tenés 2 días"
- TRIAL_EXPIRED + 2 días → email "mañana se suspende"
- TRIAL_EXPIRED + 3 días → SUSPENDED + Studio.active=false + email
- PAST_DUE + 1 día → email "pago fallido"
- PAST_DUE + 7 días → SUSPENDED + Studio.active=false + email
- PlatformEvent para cada cambio de estado
- Email resumen al Super Admin al final
Re-ejecutable de forma segura (verificar estado actual antes de actuar).
```

---

## /prompt branding
```
Leé CLAUDE.md.
Implementá el sistema de branding por estudio:
1. /src/app/[studio]/layout.tsx — leer StudioBranding de la DB, inyectar CSS variables:
   :root { --color-primary: X; --color-accent: Y; }
   Si logoUrl: mostrar imagen. Si no: mostrar studioName en texto.
2. /src/app/[studio]/admin/settings/branding/page.tsx — formulario de configuración:
   - Color picker para primaryColor y accentColor
   - Upload de logo (usar @vercel/blob: import { put } from '@vercel/blob')
   - Preview en tiempo real del header con los cambios
   - Campo welcomeMessage
3. /src/app/api/[studio]/admin/branding/route.ts — PATCH endpoint
Solo accesible para STUDIO_ADMIN.
```

---

## /prompt whatsapp
```
Leé CLAUDE.md.
Implementá /src/services/notification.service.ts que unifica email y WhatsApp:
- sendNotification({ userId, studioId, type, data }) — decide si mandar email, WhatsApp o ambos
- WhatsApp solo si: studio.whatsappEnabled=true AND user.phone existe AND user.whatsappOptOut=false
- Usar Twilio: import twilio from 'twilio'
- Si falla WhatsApp: loguear error, NO lanzar excepción (el email es el fallback)
Tipos de notificación:
  BOOKING_CONFIRMED, CLASS_REMINDER, WAITLIST_PROMOTED, GRACE_WARNING, PAYMENT_APPROVED
Reemplazar todos los sendEmail() directos en los services existentes por sendNotification().
```

---

## /prompt insights
```
Leé CLAUDE.md y DATABASE.md.
Implementá el sistema de IA insights:
1. /src/services/insights.service.ts
   - Verificar plan PRO del estudio
   - Verificar cache (campo insightsCacheData + insightsCachedAt en studio_settings — agregar en migración)
   - Si cache < 24hs: devolver cache
   - Si no: ejecutar queries de métricas (todas con WHERE studioId)
   - Llamar a Anthropic API: import Anthropic from '@anthropic-ai/sdk'
   - Modelo: claude-sonnet-4-20250514, max_tokens: 800
   - Parsear respuesta como JSON array: [{title, body, type}]
   - Guardar en cache
2. GET /api/[studio]/insights/route.ts — solo STUDIO_ADMIN
3. Cards en el dashboard admin: tipo info (azul), warning (naranja), opportunity (verde)
```

---

## /prompt landing
```
Leé CLAUDE.md y /screen.
Implementá la landing page en /src/app/(landing)/page.tsx:
Secciones en orden:
1. Nav: logo + "Iniciar sesión" + "Empezar gratis"
2. Hero: título grande, subtítulo, CTA "Empezar 14 días gratis" → /registro, imagen/mockup de la app
3. Problema: "¿Seguís gestionando tu estudio por WhatsApp?" — 3 dolores
4. Solución: 4 features principales con iconos
5. Precios: 2 planes (BÁSICO y PRO) con tabla comparativa
6. CTA final: "Probalo gratis 14 días — sin tarjeta"
7. Footer: links legales
Mobile-first. Colores del sistema de diseño. Fuentes: Cormorant Garamond + DM Sans.
```

---

## /prompt superadmin
```
Leé CLAUDE.md.
Implementá el panel de Super Admin en /src/app/superadmin/:
Solo accesible con role=SUPER_ADMIN.
Páginas:
1. /superadmin/page.tsx — dashboard: total estudios, activos, en trial, suspendidos, revenue estimado del mes
2. /superadmin/estudios/page.tsx — tabla de todos los estudios con: nombre, slug, estado de suscripción, plan, alumnos activos, fecha de registro
3. /superadmin/estudios/[studioId]/page.tsx — detalle de un estudio: métricas, historial de pagos, acciones (suspender, reactivar, extender trial)
4. Acciones manuales: botón "Suspender estudio", "Reactivar", "Extender trial X días"
No necesita ser bonito — es solo para vos.
```
