# DATABASE.md — Especificación Completa de Base de Datos
## Versión definitiva — auditoría completa realizada

---

## Principios de integridad (verificar en CADA operación)

- ¿La query filtra por `studioId`? Si no → BUG CRÍTICO DE SEGURIDAD
- ¿El `studioId` viene del contexto del servidor, no del body del cliente?
- ¿La operación modifica más de una tabla? → `$transaction()` obligatorio
- ¿La operación modifica bookings + créditos? → `FOR UPDATE` en la lectura previa
- ¿Se está borrando algún registro? → NUNCA. Solo cambiar `status`
- ¿El email se envía dentro de la transacción? → NUNCA. Siempre después, en try/catch separado

---

## Tablas y sus responsabilidades

### `studios`
Registro de cada estudio cliente. Punto de entrada del tenant.
- `slug` único globalmente → resuelve el subdominio
- `active: false` → estudio suspendido, ningún alumno puede acceder
- No tiene `studioId` — es la raíz del tenant

### `studio_settings`
Toda lógica de negocio lee de aquí. Nunca valores hardcodeados en el código.
- `cancellationHours` → ventana para cancelar con crédito
- `lateCancellationPolicy` → LOSE_CREDIT o KEEP_CREDIT
- `noShowPolicy` → LOSE_CREDIT o KEEP_CREDIT
- `generationDayOfMonth` → default 25
- `waitlistAutoPromote` → si true, promueve automáticamente al cancelar
- `gracePeriodEnabled` → habilita el período de gracia
- `gracePeriodCutoffDay` → día límite de pago (default 10)
- `graceRequiresHistory` → requiere al menos 1 mes previo pagado
- `graceOnNoPay` → RELEASE_TO_WAITLIST o KEEP_AND_ALERT si no paga antes del cutoff

### `users`
Alumnos y admins. Pertenecen a un solo estudio.
- `@@unique([email, studioId])` → mismo email puede existir en dos estudios distintos
- `active: false` → no puede reservar (error USER_NOT_ACTIVE)
- `phone` → opcional pero recomendado para notificaciones
- Roles: SUPER_ADMIN (vos) · STUDIO_ADMIN · STUDENT

### `class_types`
Tipos de clase del estudio.
- `defaultCapacity` → puede ser sobreescrita por sesión
- `active: false` → ya no se ofrecen clases de este tipo

### `class_sessions`
Cada clase concreta. Creadas por el cron el día 25.
- `@@unique([studioId, date, time, classTypeId])` → no puede haber dos iguales
- `cancelledAt` → clase cancelada por el estudio
- `capacityOverride` → null = usar `classType.defaultCapacity`
- Al cancelar: afectar TODOS los bookings (CONFIRMED y WAITLIST)
- Limitación conocida: el cron no contempla feriados argentinos.
  El estudio los cancela manualmente. Solución automática prevista para fase 2.

### `packages`
Paquetes disponibles para comprar.
- `price` en centavos ARS. Ejemplo: $24.000 = 2.400.000
- `active: false` → no se puede comprar, pero los ya comprados siguen vigentes

### `user_packages`
Fuente de verdad de créditos. Un alumno puede tener múltiples activos simultáneamente.
- `classesRemaining` → nunca puede ser negativo (constraint CHECK en DB)
- `expiresAt` → último día del mes a las 23:59:59
- Los créditos no usados al vencer NO desaparecen.
  El paquete vencido sigue disponible mientras tenga `classesRemaining > 0`
- FIFO por `expiresAt`: se consume primero el que vence antes.
  Esto significa que los créditos de meses anteriores se usan primero que los nuevos.
- `paymentStatus: PENDING` → sin créditos disponibles
- `paymentStatus: APPROVED` → créditos activos y usables
- `paymentStatus: CANCELLED` → plan cambiado, no usar estos créditos
- `packageId` → nullable. Null cuando es un ajuste manual del admin (ADMIN_GRANT)
- `approvedBy` → userId del admin (efectivo/transferencia/ajuste manual)
- `paymentMethod` → MERCADOPAGO · TRANSFER · CASH · ADMIN_GRANT
- `paymentId` → ID de MercadoPago. Usado para idempotencia en webhooks.

**Query estándar para obtener créditos disponibles (FIFO):**
```typescript
prisma.userPackage.findFirst({
  where: {
    userId,
    studioId,
    paymentStatus: 'APPROVED',
    classesRemaining: { gt: 0 }
    // NO filtrar por expiresAt — los vencidos con saldo siguen disponibles
  },
  orderBy: { expiresAt: 'asc' }  // el que vence antes, primero
})
```

### `bookings`
NUNCA se borran. Solo cambian de status.
- `CONFIRMED` + `userPackageId != null` → reserva activa con crédito descontado
- `CONFIRMED` + `userPackageId = null` → reserva en período de gracia (deuda pendiente)
- `CANCELLED` → cancelada. Ver `creditRefunded`
- `WAITLIST` → en lista de espera. Crédito NUNCA descontado en este status
- `@@unique([userId, classSessionId])` → no puede haber dos reservas del mismo alumno en la misma sesión
- `origin` → RECURRING (cron) · MANUAL (alumno) · ADMIN
- `attendanceStatus` → se completa después de la clase: ATTENDED · NO_SHOW
- `creditRefunded` → true si al cancelar se devolvió el crédito

**Señal de deuda de gracia:**
`userPackageId = null AND status = CONFIRMED`
No existe campo `isGrace`. Esta combinación es suficiente y evita información duplicada.

### `recurring_schedules`
Configuración de días fijos por alumno.
- Tanto el alumno como el admin pueden crear y modificar
- Un alumno puede tener múltiples activos (ej: lunes 9:00 Y miércoles 16:00)
- Para cambiar un horario: `active: false` en el anterior + crear uno nuevo
- El cron del día 25 lee solo `active: true`

### `credit_transactions`
Log auditable. Nunca se modifica, solo se inserta.
Cada cambio en `classesRemaining` → crear un registro acá sin excepción.
- `amount` positivo = suma · negativo = descuento
- `balanceAfter` = saldo después del movimiento (evita recalcular para auditoría)

Tipos:
- `PURCHASE` → compra de paquete (+N)
- `BOOKING_DEDUCT` → reserva confirmada (-1)
- `CANCELLATION_REFUND` → cancelación dentro de ventana (+1)
- `GRACE_DEBT_SETTLEMENT` → liquidación de clases en período de gracia (-N)
- `PLAN_CHANGE_DEDUCT` → créditos que salen del plan viejo
- `PLAN_CHANGE_TRANSFER` → créditos que entran al plan nuevo
- `ADMIN_ADJUSTMENT` → asignación o corrección manual del admin

### `audit_logs`
Log de acciones. Nunca se modifica, solo se inserta.
Registrar: creación/cancelación de bookings, ajustes de créditos, cambios de
configuración, cancelación de sesiones, activación de paquetes, cambios de plan,
liquidaciones de gracia, onboarding de estudio, asignaciones manuales de créditos.

### `subscriptions`
Suscripción SaaS del estudio a la plataforma.
- `status: SUSPENDED` → todos los alumnos del estudio no pueden acceder
- Verificar en el middleware antes de resolver el tenant

---

## Relaciones críticas

```
Studio (1) ──── (1) StudioSettings
Studio (1) ──── (1) Subscription
Studio (1) ──── (N) Users
Studio (1) ──── (N) ClassTypes
Studio (1) ──── (N) ClassSessions ←──────── (1) ClassType
Studio (1) ──── (N) Packages
User   (1) ──── (N) UserPackages ←───────── (0-1) Package  [null si es ADMIN_GRANT]
User   (1) ──── (N) Bookings ────────────── (1) ClassSession
                              └──────────── (0-1) UserPackage
                                            null = reserva en gracia
User   (1) ──── (N) RecurringSchedules
UserPackage (1) ── (N) CreditTransactions
```

---

## Flujos completos

### 1. Crear reserva
```
PRE: ClassSession → FOR UPDATE (bloqueo contra race condition)

1. Verificar User.active = true → si no: USER_NOT_ACTIVE
2. Verificar Subscription.status activo → si no: STUDIO_SUSPENDED
3. Verificar ClassSession.cancelledAt = null → si no: SESSION_CANCELLED
4. Verificar que classSession.date > ahora → si no: CLASS_IN_PAST
5. Verificar ventana mínima (bookingWindowHours) → si no: BOOKING_WINDOW_CLOSED
6. Contar Bookings CONFIRMED en esa sesión → si >= capacidad:
   → throw CLASS_FULL_WAITLIST (si allowWaitlist=true)
   → throw CLASS_FULL (si allowWaitlist=false)
7. Verificar que no existe Booking del mismo userId+classSessionId → ALREADY_BOOKED
8. Buscar UserPackage disponible (query FIFO)

   ¿Tiene créditos?
   → UserPackage.update classesRemaining -1
     Booking.create CONFIRMED, userPackageId=<id>
     CreditTransaction.create BOOKING_DEDUCT -1

   ¿No tiene créditos pero califica para gracia?
   (gracePeriodEnabled + historial + antes del cutoffDay)
   → Booking.create CONFIRMED, userPackageId=null

   ¿No califica para nada?
   → throw NO_CREDITS

9. AuditLog.create BOOKING_CREATED

POST-TRANSACCIÓN (try/catch separado, no bloquea si falla):
   Enviar email de confirmación al alumno
```

### 2. Cancelar reserva
```
PRE: verificar que booking.userId = usuario autenticado
     o que quien cancela es STUDIO_ADMIN del mismo estudio

1. Verificar status=CONFIRMED o WAITLIST

2. Si status=WAITLIST:
   Booking.update CANCELLED, creditRefunded=false
   (nunca hubo crédito — fin)

3. Si status=CONFIRMED:
   Calcular hoursUntilClass
   isLate = hoursUntilClass < settings.cancellationHours
   shouldRefund = isLate ? (policy === 'KEEP_CREDIT') : true

   Booking.update CANCELLED, cancelledAt, cancellationReason, creditRefunded

   Si shouldRefund=true Y userPackageId != null:
     UserPackage.update classesRemaining +1
     CreditTransaction.create CANCELLATION_REFUND +1

   Si userPackageId=null (era gracia):
     creditRefunded=false — no había crédito

4. Si settings.waitlistAutoPromote → ejecutar flujo "Promover waitlist"
5. AuditLog.create BOOKING_CANCELLED

POST-TRANSACCIÓN:
   Enviar email de confirmación de cancelación
```

### 3. Promover waitlist
```
Buscar Bookings WAITLIST para esa classSession
ORDER BY createdAt ASC

Para cada candidato en orden:
  ¿Tiene UserPackage APPROVED con classesRemaining > 0?
  → UserPackage.update classesRemaining -1
    Booking.update CONFIRMED, userPackageId=<id>
    CreditTransaction.create BOOKING_DEDUCT -1
    Notificar alumno: "Tu lugar fue confirmado"
    STOP

  ¿No tiene créditos pero califica para gracia?
  → Booking.update CONFIRMED, userPackageId=null
    Notificar alumno: "Tu lugar fue confirmado"
    STOP

  ¿No tiene créditos y no califica?
  → Notificar alumno: "Hay un lugar disponible pero necesitás renovar tu paquete"
  → Continuar con el siguiente candidato

Si ningún candidato tiene cobertura → lugar libre, sin promover
```

### 4. Cancelar sesión entera
```
PRE: verificar que classSession.studioId = studioId del admin

1. ClassSession.update cancelledAt=now()

2. Para CADA Booking de esa sesión (CONFIRMED + WAITLIST):

   CONFIRMED + userPackageId != null:
     Booking.update CANCELLED, CLASS_CANCELLED, creditRefunded=true
     UserPackage.update classesRemaining +1
     CreditTransaction.create CANCELLATION_REFUND +1

   CONFIRMED + userPackageId=null (gracia):
     Booking.update CANCELLED, CLASS_CANCELLED, creditRefunded=false

   WAITLIST (cualquier userPackageId):
     Booking.update CANCELLED, CLASS_CANCELLED, creditRefunded=false

3. AuditLog.create SESSION_CANCELLED con cantidad de afectados

POST-TRANSACCIÓN:
   Notificar a TODOS los afectados (CONFIRMED + WAITLIST)
```

### 5. Activar paquete con liquidación de gracia
```
Aplica cuando paymentStatus pasa de PENDING a APPROVED

PRE — Idempotencia (evitar doble procesamiento de webhook):
  Verificar que NO existe UserPackage con paymentId=<id> y status=APPROVED
  Si ya existe → return sin hacer nada

1. UserPackage.update APPROVED, activatedAt=now()
2. CreditTransaction.create PURCHASE +classesTotal

3. LIQUIDAR DEUDA — clases ya asistidas sin crédito:
   Booking.findMany WHERE userId + studioId
     + userPackageId=null + status=CONFIRMED
     + classSession.date <= hoy
   ORDER BY createdAt ASC

   debtToCover = min(debtBookings.length, classesTotal)
   Booking.updateMany (primeros debtToCover) → userPackageId=<id>
   CreditTransaction.create GRACE_DEBT_SETTLEMENT -debtToCover
   remainingAfterDebt = classesTotal - debtToCover

4. VINCULAR RESERVAS FUTURAS:
   Booking.findMany WHERE userId + studioId
     + userPackageId=null + status=CONFIRMED
     + classSession.date > hoy
   ORDER BY classSession.date ASC

   futureToCover = min(futureBookings.length, remainingAfterDebt)
   Booking.updateMany (primeros futureToCover) → userPackageId=<id>
   CreditTransaction.create BOOKING_DEDUCT -futureToCover

   Sobrantes que no alcanzaron créditos:
   Booking.updateMany → status=WAITLIST

5. UserPackage.update classesRemaining = classesTotal - debtToCover - futureToCover
6. AuditLog.create PACKAGE_ACTIVATED con resumen

POST-TRANSACCIÓN:
   Notificar al alumno con detalle: créditos totales, deuda saldada, reservas vinculadas
```

### 6. Asignación manual de créditos por el admin
```
PRE: verificar que el admin y el alumno pertenecen al mismo studioId

1. Buscar UserPackage activo más reciente del alumno:
   UserPackage.findFirst WHERE userId + studioId + paymentStatus=APPROVED
   ORDER BY expiresAt DESC (el más reciente)

   ¿Existe un paquete activo?
   → Usar ese paquete

   ¿No existe ningún paquete activo?
   → Crear UserPackage especial:
     packageId=null
     paymentMethod=ADMIN_GRANT
     paymentStatus=APPROVED
     classesTotal=cantidad asignada
     classesRemaining=cantidad asignada
     expiresAt=último día del mes actual
     approvedBy=adminUserId

2. UserPackage.update classesRemaining += cantidad
   (si cantidad es negativa, verificar que no quede < 0)

3. CreditTransaction.create:
   type=ADMIN_ADJUSTMENT
   amount=cantidad (positivo o negativo)
   balanceAfter=nuevo saldo
   note=motivo ingresado por el admin
   createdBy=adminUserId

4. AuditLog.create CREDIT_ADJUSTED_MANUALLY
   with: before={classesRemaining: anterior}, after={classesRemaining: nuevo}

POST-TRANSACCIÓN:
   Notificar al alumno si la cantidad es positiva:
   "Tu instructor te asignó N crédito/s adicionales"
```

### 7. Cambio de plan
```
1. Obtener classesRemaining del UserPackage viejo
2. UserPackage.update (viejo) → CANCELLED, classesRemaining=0
3. CreditTransaction.create PLAN_CHANGE_DEDUCT -creditosRestantes

4. UserPackage.create (nuevo):
   classesTotal = newPackage.classCount + creditosRestantes
   classesRemaining = classesTotal
   expiresAt = último día del mes actual

5. CreditTransaction.create PLAN_CHANGE_TRANSFER +creditosRestantes

6. REASIGNAR reservas futuras al paquete nuevo:
   Booking.updateMany WHERE userId + userPackageId=<viejo> + classSession.date > hoy
   → userPackageId=<nuevo>
   (las reservas pasadas quedan en el paquete viejo — correcto para auditoría)

7. AuditLog.create PLAN_CHANGED
```

### 8. Generación automática — día 25
```
Endpoint: POST /api/cron/generate-month
Header: Authorization: Bearer CRON_SECRET
Re-ejecutable de forma segura: upsert + @@unique previenen duplicados

Para cada estudio activo con suscripción vigente:

  PASO 1 — Generar class_sessions del mes siguiente:
    Para cada día hábil lunes-viernes:
      Para cada hora de 9 a 20:
        Para cada ClassType activo:
          ClassSession.upsert

  PASO 2 — Aplicar recurring_schedules (active=true):
    Para cada schedule:
      Para cada ClassSession del mes que matchea:
        Si ya existe Booking para ese userId+sessionId → skip

        ¿Tiene UserPackage APPROVED con classesRemaining > 0?
        → Flujo "Crear reserva" (con crédito)

        ¿No tiene créditos pero califica para gracia?
        → Booking.create CONFIRMED, userPackageId=null, origin=RECURRING

        ¿No califica?
        → Agregar a lista de alertas, no crear booking

  PASO 3 — Email resumen al admin:
    Sesiones generadas / Reservas con crédito /
    Reservas en gracia / Alumnos sin cobertura

Día gracePeriodCutoffDay — segundo cron:
  Para cada Booking CONFIRMED con userPackageId=null del mes:
    Si sigue sin UserPackage APPROVED:
      RELEASE_TO_WAITLIST → Booking.update WAITLIST
      KEEP_AND_ALERT → mantener + notificar admin
```

---

## Período de gracia — Reglas completas

**¿Quién califica?**
Alumno con al menos 1 UserPackage `paymentStatus=APPROVED` en meses anteriores.

**Señal de reserva en gracia:**
`userPackageId = null AND status = CONFIRMED`
No existe campo `isGrace`.

**Cancelación de reserva en gracia:**
`creditRefunded = false` siempre. No hubo crédito.

**Promoción desde waitlist sin créditos:**
Si califica para gracia → promover con `userPackageId=null`.
Si no califica → notificar y pasar al siguiente.

**Créditos acumulados del mes anterior:**
Los paquetes vencidos con `classesRemaining > 0` siguen disponibles.
FIFO los consume primero. Si tiene saldo → no aplica gracia.

**Si no paga antes del cutoffDay:**
`RELEASE_TO_WAITLIST` → reservas futuras pasan a WAITLIST.
`KEEP_AND_ALERT` → admin recibe lista y decide.

---

## Protecciones de integridad en la base de datos

Estas constraints se agregan directamente en la migración SQL.
Prisma no las genera automáticamente — hay que agregarlas a mano:

```sql
-- classesRemaining nunca puede ser negativo
ALTER TABLE user_packages
ADD CONSTRAINT classes_remaining_non_negative
CHECK (classes_remaining >= 0);

-- El rol SUPER_ADMIN no puede tener studioId
-- (se valida en la lógica, no en DB — demasiado complejo como constraint)
```

---

## Índices definidos

```prisma
// bookings
@@unique([userId, classSessionId])
@@index([studioId, classSessionId, status])    // contar capacidad
@@index([studioId, userId, status])            // mis reservas
@@index([studioId, userPackageId])             // liquidación gracia + reportes
@@index([studioId, userId, userPackageId])     // buscar reservas en gracia

// class_sessions
@@unique([studioId, date, time, classTypeId])
@@index([studioId, date])
@@index([studioId, classTypeId, date])

// user_packages
@@index([studioId, userId, expiresAt])         // FIFO de créditos
@@index([studioId, paymentStatus])             // reportes
@@index([studioId, userId, paymentStatus])     // elegibilidad para gracia
@@index([studioId, paymentId])                 // idempotencia webhook

// recurring_schedules
@@index([studioId, userId, active])
@@index([studioId, dayOfWeek, time])

// credit_transactions
@@index([studioId, userPackageId])
@@index([studioId, createdAt])

// audit_logs
@@index([studioId, createdAt])
@@index([studioId, userId])
```

---

## Checklist de auto-validación

```
SEGURIDAD MULTI-TENANT
[ ] ¿Toda query filtra por studioId?
[ ] ¿El studioId viene del servidor, no del cliente?

TRANSACCIONES
[ ] ¿Operaciones multi-tabla usan $transaction()?
[ ] ¿Crear reserva usa FOR UPDATE en ClassSession?
[ ] ¿Todo cambio en classesRemaining tiene su CreditTransaction?
[ ] ¿El email se envía FUERA de la transacción en try/catch separado?

IDEMPOTENCIA
[ ] ¿El webhook de MercadoPago verifica paymentId antes de procesar?

REGLAS DE NEGOCIO
[ ] ¿Ninguna función llama a .delete()?
[ ] ¿classesRemaining puede quedar negativo? → bug si sí
[ ] ¿Una reserva en gracia devuelve crédito al cancelar? → no debe
[ ] ¿Al cancelar sesión se cancelan también los WAITLIST?
[ ] ¿Al cambiar plan las reservas futuras se reasignan al paquete nuevo?
[ ] ¿La promoción de waitlist saltea candidatos sin créditos ni gracia?
[ ] ¿El ajuste manual verifica que admin y alumno son del mismo estudio?

PERÍODO DE GRACIA
[ ] ¿El alumno califica antes de crear booking sin crédito?
[ ] ¿La liquidación cubre deuda pasada antes que reservas futuras?
[ ] ¿Si no alcanzan los créditos, los sobrantes pasan a WAITLIST?
[ ] ¿Se registra GRACE_DEBT_SETTLEMENT en credit_transactions?

ERRORES
[ ] ¿Los errores usan códigos tipados?
[ ] ¿CLASS_FULL verifica waitlist antes de lanzar el error?
```

---

## Códigos de error del sistema

```typescript
type BookingError =
  | 'CLASS_FULL'                  // sin lugares y sin waitlist
  | 'CLASS_FULL_WAITLIST'         // sin lugares pero puede anotarse en waitlist
  | 'ALREADY_BOOKED'              // ya tiene reserva en esa sesión
  | 'NO_CREDITS'                  // sin créditos y no califica para gracia
  | 'PACKAGE_EXPIRED'             // paquete vencido sin saldo
  | 'CLASS_IN_PAST'               // la sesión ya ocurrió
  | 'BOOKING_WINDOW_CLOSED'       // menos de X horas de anticipación
  | 'CANCELLATION_WINDOW_CLOSED'  // fuera de la ventana para cancelar con crédito
  | 'USER_NOT_ACTIVE'             // admin desactivó al usuario
  | 'CLASS_NOT_FOUND'             // la sesión no existe
  | 'STUDIO_SUSPENDED'            // suscripción del estudio suspendida
  | 'GRACE_PERIOD_EXPIRED'        // pasó el cutoffDay sin pagar
  | 'SESSION_CANCELLED'           // la clase fue cancelada por el estudio
```

---

## Limitaciones conocidas (solución prevista para fase 2)

- **Feriados argentinos:** el cron genera clases todos los días hábiles sin
  considerar feriados. El estudio los cancela manualmente. En fase 2 se agrega
  tabla `studio_holidays` para que el admin los marque antes del día 25.

- **Notificaciones por WhatsApp:** actualmente solo email. En fase 2
  integrar Twilio WhatsApp API usando el campo `phone` de `users`.

- **Panel de Super Admin:** hasta fase 3 la gestión de estudios
  se hace directamente con Prisma Studio en el servidor.
