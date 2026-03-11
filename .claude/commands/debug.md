# /debug — Debugging sistemático por capas

Cuando el usuario invoca /debug con un error o comportamiento inesperado, seguí este proceso en orden.

## Proceso de debugging por capas

### Capa 1 — Identificar el tipo de error
```
¿Es un error de compilación TypeScript? → Revisar tipos
¿Es un error de runtime en el servidor? → Revisar logs de Next.js
¿Es un error de la DB? → Revisar query en Prisma Studio
¿Es un comportamiento incorrecto (no un error)? → Revisar la lógica contra DATABASE.md
```

### Capa 2 — Errores comunes del proyecto

**"Cannot read properties of null"** en un service:
→ El studioId no se está pasando correctamente
→ El usuario no tiene el rol correcto
→ El registro no pertenece a ese studioId

**"Transaction failed"** o rollback inesperado:
→ Revisar si hay una operación que falla dentro de `$transaction()`
→ Agregar try/catch dentro de la transacción para identificar el paso exacto
→ Verificar que `FOR UPDATE` no está causando deadlock

**"P2002 Unique constraint failed"**:
→ En bookings: el alumno ya tiene reserva en esa sesión (ALREADY_BOOKED)
→ En class_sessions: el cron intentó crear una sesión duplicada (el upsert debería evitar esto)
→ En users: email duplicado en el mismo estudio

**"P2003 Foreign key constraint failed"**:
→ El studioId, userId o classSessionId que se está usando no existe
→ Verificar que el registro padre existe antes de crear el hijo

**Créditos incorrectos**:
→ Abrir Prisma Studio → tabla credit_transactions → filtrar por userId
→ Verificar que cada cambio en classesRemaining tiene su CreditTransaction
→ Sumar todos los amounts: debe coincidir con classesRemaining actual

### Capa 3 — Herramientas de diagnóstico

```bash
# Ver logs en tiempo real
npx next dev 2>&1 | grep -E "Error|Warning|prisma"

# Abrir Prisma Studio para inspeccionar datos
npx prisma studio

# Verificar que las migraciones están al día
npx prisma migrate status

# Reset de DB en desarrollo (CUIDADO — borra todo)
npx prisma migrate reset
```

### Capa 4 — Si sigue sin resolverse
Adjuntá al prompt:
1. El error exacto completo (stack trace)
2. El archivo donde ocurre
3. El resultado esperado vs el resultado actual
4. Qué datos hay en la DB en ese momento (captura de Prisma Studio)
