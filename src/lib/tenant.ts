import { cache } from 'react'
import { prisma } from './prisma'

type TenantResult = { studioId: string; slug: string } | null

/**
 * Resuelve el studioId a partir del hostname.
 * Soporta subdominios en producción y path-based en dev.
 *
 * Producción: centro-pilates.pilatesapp.com → slug = "centro-pilates"
 * Dev:        centro-pilates.localhost:3000  → slug = "centro-pilates"
 *
 * Memoizado por request via React cache().
 */
export const getTenant = cache(async (hostname: string): Promise<TenantResult> => {
  // Quitar puerto: "centro-pilates.localhost:3000" → "centro-pilates.localhost"
  const host = hostname.split(':')[0]

  // Extraer subdominio
  const parts = host.split('.')
  if (parts.length < 2) return null

  const slug = parts[0]
  if (!slug || slug === 'www' || slug === 'app') return null

  const studio = await prisma.studio.findUnique({
    where: { slug, active: true },
    select: { id: true, slug: true },
  })

  if (!studio) return null

  return { studioId: studio.id, slug: studio.slug }
})

/**
 * Versión para uso en Server Components y Route Handlers.
 * Acepta el slug directamente (desde params de la URL dinámica [studio]).
 */
export const getTenantBySlug = cache(async (slug: string): Promise<TenantResult> => {
  const studio = await prisma.studio.findUnique({
    where: { slug, active: true },
    select: { id: true, slug: true },
  })

  if (!studio) return null

  return { studioId: studio.id, slug: studio.slug }
})
