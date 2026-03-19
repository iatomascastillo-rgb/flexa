/**
 * Formatters compartidos — zona horaria: America/Argentina/Buenos_Aires (UTC-3 fijo).
 *
 * Convenciones de nombres:
 *   fmtTime      → "09:00" a "9:00"  (strip leading zero de horas)
 *   fmtDateUTC   → fecha DB (@db.Date = medianoche UTC), weekday largo  "lunes 5 de mayo"
 *   fmtDateShort → fecha AR con año, sin weekday              "5 may. 2025"
 *   fmtDateAR    → fecha AR weekday corto + día + mes corto   "lun. 5 may."  (home page)
 *   fmtDateFull  → fecha con weekday largo + año              "lunes, 5 de mayo de 2025"
 *   fmtDateTime  → fecha + hora AR                            "5 may. 12:30"
 *   fmtARS       → moneda ARS sin decimales
 *   todayARStart → medianoche UTC del día actual en Argentina
 *   initials     → primeras dos iniciales de un nombre
 */

const AR_TZ = 'America/Argentina/Buenos_Aires'

// ── Hora ─────────────────────────────────────────────────────────────────────

/** "09:00" → "9:00"  (elimina el cero inicial de la hora) */
export function fmtTime(time: string): string {
  const [h, m] = time.split(':')
  return `${parseInt(h)}:${m}`
}

// ── Fechas ───────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha DB (@db.Date = medianoche UTC) como weekday largo.
 * Ejemplo: "lunes 5 de mayo"
 * Usado en: admin/sesiones/page.tsx, admin/sesiones/[sessionId]/page.tsx,
 *           settings/feriados/page.tsx
 */
export function fmtDateUTC(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/**
 * Fecha corta con año en zona Argentina.
 * Ejemplo: "5 may. 2025"
 * Usado en: admin/students/[userId]/page.tsx, admin/settings/feriados (expiresAt email),
 *           superadmin/page.tsx (fmtDateShort), superadmin/estudios/page.tsx,
 *           superadmin/estudios/[studioId]/page.tsx (fmtDateShort)
 */
export function fmtDateShort(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: AR_TZ,
  })
}

/**
 * Fecha corta AR con weekday corto, sin año.
 * Ejemplo: "lun. 5 may."
 * Usado en: [studio]/page.tsx (ClassCard — fmtDate con weekday short + día + mes short)
 */
export function fmtDateAR(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/**
 * Fecha larga con weekday, día, mes y año en zona Argentina.
 * Ejemplo: "lunes, 5 de mayo de 2025"
 * Usado en: admin/page.tsx (nowLabel inline, no extraído)
 */
export function fmtDateFull(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: AR_TZ,
  })
}

/**
 * Fecha completa UTC con weekday largo, día, mes largo y año.
 * Ejemplo: "lunes 5 de mayo de 2025"
 * Usado en: admin/settings/feriados/page.tsx
 */
export function fmtDateFullUTC(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Fecha + hora en zona Argentina.
 * Ejemplo: "5 may. 12:30"
 * Usado en: admin/students/[userId]/page.tsx (fmtDateTime),
 *           api/admin/export/bookings/route.ts (fmtDateTime con formato dd/MM/yyyy HH:mm)
 */
export function fmtDateTime(date: Date): string {
  return date.toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: AR_TZ,
  })
}

// ── Moneda ───────────────────────────────────────────────────────────────────

/**
 * Formatea un número como pesos argentinos sin decimales.
 * El argumento debe estar en ARS (no centavos).
 * Ejemplo: fmtARS(12000) → "$ 12.000"
 * Usado en: admin/page.tsx, superadmin/page.tsx
 */
export function fmtARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Fecha de hoy en Argentina ─────────────────────────────────────────────────

/**
 * Devuelve medianoche UTC del día actual en zona Argentina (UTC-3 fijo).
 * Usado en: admin/page.tsx, instructor/page.tsx, instructor/[sessionId]/page.tsx,
 *           api/instructor/attendance/route.ts
 */
export function todayARStart(): Date {
  const now = new Date()
  const arMs = now.getTime() + -3 * 60 * 60_000
  const ar = new Date(arMs)
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()))
}

// ── Texto ────────────────────────────────────────────────────────────────────

/**
 * Primeras dos iniciales en mayúsculas a partir de un nombre completo.
 * Ejemplo: "Ana García" → "AG"
 * Usado en: admin/students/page.tsx
 */
export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
