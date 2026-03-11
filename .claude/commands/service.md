# /service — Crear nuevo service

Cuando el usuario invoca /service [nombre], creá el archivo `/src/services/[nombre].service.ts` siguiendo esta estructura exacta.

## Estructura obligatoria de un service

```typescript
// /src/services/[nombre].service.ts
import { prisma } from '@/lib/prisma'
import { AppError } from '@/types/errors'

// Todas las funciones exportadas son async
// Todas reciben studioId como primer parámetro o dentro del input
// Ninguna función hace .delete() — solo cambian status

export async function ejemploFuncion(
  studioId: string,  // SIEMPRE el primer parámetro
  input: EjemploInput
): Promise<EjemploOutput> {

  // 1. Validaciones previas (sin transacción)
  
  // 2. Operación principal en transacción si toca más de una tabla
  return await prisma.$transaction(async (tx) => {
    
    // 3. FOR UPDATE si toca bookings + créditos
    // await tx.$executeRaw`SELECT id FROM class_sessions WHERE id = ${sessionId} FOR UPDATE`
    
    // 4. Lógica de negocio
    
    // 5. AuditLog al final de la transacción
    await tx.auditLog.create({
      data: {
        studioId,
        userId: input.actorId,
        action: 'ACCION_REALIZADA',
        entityId: result.id,
        after: result
      }
    })
    
    return result
  })
  
  // 6. Efectos secundarios FUERA de la transacción
  // try { await sendEmail(...) } catch (e) { console.error(e) }
}
```

## Checklist al crear un service
- El archivo va en `/src/services/`
- Importa `prisma` desde `@/lib/prisma` (singleton)
- Todo input incluye `studioId`
- Toda query filtra por `studioId`
- Transacción si modifica más de una tabla
- AuditLog en operaciones importantes
- Emails y notificaciones fuera de la transacción
- Tipos de error de `/src/types/errors.ts`
