# /validate — Checklist de validación pre-entrega

Revisá el código adjunto con este checklist y reportá cada ítem con ✅ o ❌ con explicación si falla.

## SEGURIDAD MULTI-TENANT
- [ ] ¿Toda query tiene `WHERE studioId = ?`?
- [ ] ¿El `studioId` viene del contexto del servidor (session/middleware), no del body del cliente?
- [ ] ¿Ningún endpoint expone datos de otro estudio?
- [ ] ¿Los endpoints públicos (/api/public/*) no exponen datos internos?

## INTEGRIDAD DE TRANSACCIONES
- [ ] ¿Operaciones que tocan más de una tabla usan `prisma.$transaction()`?
- [ ] ¿`createBooking` usa `FOR UPDATE` en la lectura de ClassSession?
- [ ] ¿Cada cambio en `classesRemaining` tiene su `CreditTransaction` correspondiente?
- [ ] ¿Los emails y WhatsApp se envían FUERA de la transacción, en try/catch separado?

## IDEMPOTENCIA
- [ ] ¿El webhook de MercadoPago (alumnos) verifica que `paymentId` no fue procesado antes?
- [ ] ¿El webhook de MP SaaS verifica idempotencia por `mpSubscriptionId`?
- [ ] ¿El cron de billing verifica el estado actual antes de actuar (no aplica dos veces)?

## REGLAS DE NEGOCIO — MVP
- [ ] ¿Ninguna función llama a `.delete()` en tablas de negocio?
- [ ] ¿`classesRemaining` puede quedar negativo? Si sí → bug crítico
- [ ] ¿Una reserva con `userPackageId=null` intenta devolver crédito al cancelar? → no debe
- [ ] ¿Al cancelar sesión entera se cancelan también los WAITLIST?
- [ ] ¿Al cambiar de plan las reservas futuras se reasignan al paquete nuevo?

## REGLAS DE NEGOCIO — FASES EXTENDIDAS
- [ ] ¿El registro de estudio valida que el slug no está en la lista negra?
- [ ] ¿La creación de estudio usa $transaction para todos los registros relacionados?
- [ ] ¿El cron de billing es re-ejecutable sin duplicar efectos?
- [ ] ¿El branding usa CSS variables, no colores hardcodeados en los componentes?
- [ ] ¿Los insights verifican el plan PRO antes de llamar a la API de Claude?
- [ ] ¿El cache de insights tiene TTL de 24hs antes de llamar a la API de nuevo?
- [ ] ¿Las notificaciones WhatsApp tienen fallback silencioso si fallan?

## TIPOS Y ERRORES
- [ ] ¿Los errores usan los códigos de `BookingError` en `/src/types/errors.ts`?
- [ ] ¿Los endpoints públicos devuelven errores genéricos (sin exponer stack traces)?

## Formato del reporte
Para cada ❌: indicar el ítem, la línea/función específica, y cómo corregirlo.
