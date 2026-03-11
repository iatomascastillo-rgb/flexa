# /migration — Generar migración Prisma segura

Cuando el usuario invoca /migration [descripcion], generá la migración siguiendo estas reglas.

## Flujo de migración

```bash
# 1. Modificar prisma/schema.prisma
# 2. Generar la migración (sin aplicar)
npx prisma migrate dev --name [descripcion] --create-only

# 3. Revisar el SQL generado en prisma/migrations/
# 4. Si la migración agrega columnas a tablas con datos existentes:
#    → Agregar DEFAULT o hacerlo nullable primero
# 5. Aplicar
npx prisma migrate dev

# 6. Regenerar el cliente
npx prisma generate
```

## Constraints que Prisma NO genera automáticamente
Agregarlos manualmente en el archivo SQL de la migración:

```sql
-- classesRemaining nunca negativo
ALTER TABLE user_packages
ADD CONSTRAINT classes_remaining_non_negative
CHECK (classes_remaining >= 0);
```

## Reglas para migraciones seguras
- Nunca `DROP COLUMN` con datos — primero hacer nullable, luego deprecar
- Nunca `DROP TABLE` directamente — renombrar primero
- Columnas nuevas en tablas existentes → siempre nullable o con DEFAULT
- Cambios de tipo → crear columna nueva, migrar datos, borrar la vieja
- Antes de aplicar en producción: siempre hacer backup de la DB

## Índices importantes del proyecto
Si se agregan tablas nuevas, verificar que tengan:
```prisma
@@index([studioId, ...])  // studioId siempre en el índice principal
```
