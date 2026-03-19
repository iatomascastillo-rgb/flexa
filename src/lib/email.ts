import { Resend } from 'resend'

// Lazy initialization: evita que el constructor falle en build time si la env var no está seteada
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}
const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const APP_NAME = 'Flexa'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type EmailTemplate =
  // Registro
  | 'bienvenida-estudio'
  | 'nuevo-estudio-superadmin'
  // Alumna
  | 'confirmacion-reserva'
  | 'cancelacion-reserva'
  | 'lista-de-espera-promovida'
  | 'nuevo-alumno-admin'
  | 'bienvenida-alumno'
  | 'clase-cancelada-alumna'
  | 'pago-aprobado'
  | 'grace-cutoff-admin'
  | 'resumen-mensual-admin'
  // Billing
  | 'trial-vencido'
  | 'trial-warning-2d'
  | 'trial-warning-1d'
  | 'trial-suspendido'
  | 'pastdue-warning-1d'
  | 'pastdue-suspendido'
  | 'admin-resumen'
  // Test
  | 'test'

// ── Helper: layout base ──────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8E0D6;">
          <!-- Header -->
          <tr>
            <td style="background:#5C7A5E;padding:24px 32px;">
              <p style="margin:0;font-size:22px;font-weight:300;color:#ffffff;letter-spacing:0.05em;">${APP_NAME}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #E8E0D6;">
              <p style="margin:0;font-size:11px;color:#9E8E82;text-align:center;">
                ${APP_NAME} · Gestión de estudios de movimiento
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Templates ────────────────────────────────────────────────────────────────

function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): { subject: string; html: string } {
  switch (template) {
    case 'test':
      return {
        subject: `[${APP_NAME}] Email de prueba`,
        html: layout('Email de prueba', `
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:300;color:#2C2C2C;">¡Todo funciona!</h1>
          <p style="margin:0 0 12px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Este es un email de prueba enviado desde <strong>${APP_NAME}</strong>.
          </p>
          <p style="margin:0;font-size:14px;color:#6B5B52;line-height:1.6;">
            Si estás viendo esto, la integración con Resend está correctamente configurada.
          </p>
        `),
      }

    case 'bienvenida-estudio':
      return {
        subject: `¡Bienvenido/a a ${APP_NAME}! Tu estudio está listo`,
        html: layout('Bienvenida', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">
            ¡Hola, ${data.adminName}!
          </h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Tu estudio <strong>${data.studioName}</strong> fue creado exitosamente.
            Tenés <strong>14 días de prueba gratuita</strong> para explorar todas las funcionalidades.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Tu acceso</p>
                <p style="margin:0 0 4px;font-size:13px;color:#2C2C2C;">
                  <strong>URL:</strong> ${data.studioUrl}
                </p>
                <p style="margin:0;font-size:13px;color:#2C2C2C;">
                  <strong>Email:</strong> ${data.adminEmail}
                </p>
              </td>
            </tr>
          </table>
          <a href="${data.studioUrl}" style="display:inline-block;background:#5C7A5E;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;">
            Ir a mi estudio
          </a>
        `),
      }

    case 'nuevo-estudio-superadmin':
      return {
        subject: `[${APP_NAME}] Nuevo estudio registrado: ${data.studioName}`,
        html: layout('Nuevo estudio', `
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:300;color:#2C2C2C;">Nuevo estudio registrado</h1>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;font-size:13px;color:#6B5B52;"><strong>Estudio:</strong> ${data.studioName}</td></tr>
            <tr><td style="padding:6px 0;font-size:13px;color:#6B5B52;"><strong>Slug:</strong> ${data.slug}</td></tr>
            <tr><td style="padding:6px 0;font-size:13px;color:#6B5B52;"><strong>Admin:</strong> ${data.adminName} (${data.adminEmail})</td></tr>
            <tr><td style="padding:6px 0;font-size:13px;color:#6B5B52;"><strong>Trial vence:</strong> ${data.trialEndsAt}</td></tr>
          </table>
        `),
      }

    case 'confirmacion-reserva':
      return {
        subject: `Reserva confirmada — ${data.className}`,
        html: layout('Reserva confirmada', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">¡Reserva confirmada!</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;">
            Hola ${data.studentName}, tu lugar está reservado.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Detalle de la clase</p>
                <p style="margin:0 0 4px;font-size:14px;color:#2C2C2C;"><strong>${data.className}</strong></p>
                <p style="margin:0 0 4px;font-size:13px;color:#6B5B52;">${data.date} · ${data.time}</p>
                ${data.instructorName ? `<p style="margin:0;font-size:13px;color:#6B5B52;">Con ${data.instructorName}</p>` : ''}
              </td>
            </tr>
          </table>
          ${data.creditsRemaining !== undefined ? `<p style="margin:0;font-size:13px;color:#9E8E82;">Te quedan <strong>${data.creditsRemaining} créditos</strong> después de esta reserva.</p>` : ''}
        `),
      }

    case 'lista-de-espera-promovida':
      return {
        subject: `¡Conseguiste lugar! — ${data.className}`,
        html: layout('¡Conseguiste lugar!', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">¡Conseguiste lugar!</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.studentName}, alguien canceló y te confirmamos desde la lista de espera.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Tu clase</p>
                <p style="margin:0 0 4px;font-size:14px;color:#2C2C2C;"><strong>${data.className}</strong></p>
                <p style="margin:0;font-size:13px;color:#6B5B52;">${data.date} · ${data.time}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#5C7A5E;">✓ Tu reserva está confirmada. ¡Te esperamos!</p>
        `),
      }

    case 'cancelacion-reserva':
      return {
        subject: `Cancelación confirmada — ${data.className}`,
        html: layout('Cancelación', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Cancelación registrada</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;">
            Hola ${data.studentName}, tu reserva fue cancelada.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 4px;font-size:14px;color:#2C2C2C;"><strong>${data.className}</strong></p>
                <p style="margin:0;font-size:13px;color:#6B5B52;">${data.date} · ${data.time}</p>
              </td>
            </tr>
          </table>
          ${data.creditRefunded
            ? `<p style="margin:0;font-size:13px;color:#5C7A5E;">✓ Tu crédito fue devuelto. Te quedan <strong>${data.creditsRemaining} créditos</strong>.</p>`
            : `<p style="margin:0;font-size:13px;color:#C4774A;">El crédito no fue devuelto por cancelación fuera de tiempo.</p>`
          }
        `),
      }

    case 'trial-vencido':
      return {
        subject: `[${APP_NAME}] Tu período de prueba venció`,
        html: layout('Trial vencido', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Tu prueba gratuita venció</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, el período de prueba de <strong>${data.studioName}</strong> llegó a su fin.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#C4774A;line-height:1.6;">
            Tenés <strong>3 días</strong> para elegir un plan antes de que el estudio quede suspendido.
          </p>
          <a href="${process.env.NEXTAUTH_URL}/precios" style="display:inline-block;background:#5C7A5E;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;">
            Ver planes
          </a>
        `),
      }

    case 'trial-warning-2d':
      return {
        subject: `[${APP_NAME}] Tu estudio se suspende en 2 días`,
        html: layout('Aviso de suspensión', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Quedan 2 días</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, <strong>${data.studioName}</strong> se suspenderá en 2 días si no elegís un plan.
          </p>
          <a href="${process.env.NEXTAUTH_URL}/precios" style="display:inline-block;background:#C4774A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;">
            Elegir plan ahora
          </a>
        `),
      }

    case 'trial-warning-1d':
      return {
        subject: `[${APP_NAME}] Tu estudio se suspende mañana`,
        html: layout('Suspensión mañana', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Mañana se suspende</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, <strong>${data.studioName}</strong> queda suspendido mañana.
          </p>
          <a href="${process.env.NEXTAUTH_URL}/precios" style="display:inline-block;background:#C4774A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;">
            Elegir plan ahora
          </a>
        `),
      }

    case 'trial-suspendido':
      return {
        subject: `[${APP_NAME}] Tu estudio fue suspendido`,
        html: layout('Estudio suspendido', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Estudio suspendido</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, <strong>${data.studioName}</strong> fue suspendido por vencimiento del trial.
            Tus datos están guardados. Podés reactivarlo eligiendo un plan.
          </p>
          <a href="${process.env.NEXTAUTH_URL}/precios" style="display:inline-block;background:#5C7A5E;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;">
            Reactivar estudio
          </a>
        `),
      }

    case 'pastdue-warning-1d':
      return {
        subject: `[${APP_NAME}] Pago pendiente — tu estudio puede suspenderse`,
        html: layout('Pago pendiente', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Pago pendiente</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, hay un problema con el pago de <strong>${data.studioName}</strong>.
            Si no se regulariza en los próximos días, el estudio quedará suspendido.
          </p>
        `),
      }

    case 'pastdue-suspendido':
      return {
        subject: `[${APP_NAME}] Tu estudio fue suspendido por pago pendiente`,
        html: layout('Suspendido por pago', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Estudio suspendido</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, <strong>${data.studioName}</strong> fue suspendido por pago pendiente.
            Contactanos para regularizar la situación.
          </p>
        `),
      }

    case 'resumen-mensual-admin':
      return {
        subject: `[${data.studioName}] Resumen de ${data.month}`,
        html: layout(`Resumen de ${data.month}`, `
          <h1 style="margin:0 0 4px;font-size:24px;font-weight:300;color:#2C2C2C;">Así cerró ${data.month}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#9E8E82;">Hola ${data.adminName}, este es el resumen de actividad de <strong>${data.studioName}</strong>.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td width="48%" style="background:#F7F3EE;border-radius:12px;padding:16px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Alumnas activas</p>
                <p style="margin:0;font-size:28px;font-weight:300;color:#2C2C2C;">${data.activeStudents}</p>
                ${(data.newStudents as number) > 0
                  ? `<p style="margin:4px 0 0;font-size:12px;color:#5C7A5E;">+${data.newStudents} nueva${(data.newStudents as number) !== 1 ? 's' : ''} este mes</p>`
                  : '<p style="margin:4px 0 0;font-size:12px;color:#9E8E82;">Sin nuevas inscripciones</p>'}
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#F7F3EE;border-radius:12px;padding:16px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Ingresos del mes</p>
                <p style="margin:0;font-size:28px;font-weight:300;color:#2C2C2C;">$${(data.revenue as number).toLocaleString('es-AR')}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#9E8E82;">${data.paidPackages} paquete${(data.paidPackages as number) !== 1 ? 's' : ''} pagado${(data.paidPackages as number) !== 1 ? 's' : ''}</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Actividad</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Clases realizadas</td>
                    <td style="font-size:13px;color:#2C2C2C;font-weight:500;text-align:right;padding-bottom:8px;">${data.totalSessions}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Ocupación promedio</td>
                    <td style="font-size:13px;color:#2C2C2C;font-weight:500;text-align:right;padding-bottom:8px;">${data.avgOccupancyPct}%</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Reservas confirmadas</td>
                    <td style="font-size:13px;color:#2C2C2C;font-weight:500;text-align:right;padding-bottom:8px;">${data.confirmedBookings}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Reservas en gracia (sin pago)</td>
                    <td style="font-size:13px;color:${(data.graceBookings as number) > 0 ? '#C4774A' : '#2C2C2C'};font-weight:500;text-align:right;padding-bottom:8px;">${data.graceBookings}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Ausencias (no-shows)</td>
                    <td style="font-size:13px;color:${(data.noShows as number) > 0 ? '#C4774A' : '#2C2C2C'};font-weight:500;text-align:right;padding-bottom:8px;">${data.noShows}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;padding-bottom:8px;">Cancelaciones de alumnas</td>
                    <td style="font-size:13px;color:#2C2C2C;font-weight:500;text-align:right;padding-bottom:8px;">${data.cancellations}</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#6B5B52;">Sin actividad este mes</td>
                    <td style="font-size:13px;color:${(data.studentsWithoutActivity as number) > 0 ? '#C4774A' : '#2C2C2C'};font-weight:500;text-align:right;">${data.studentsWithoutActivity}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:12px;color:#C4B8AC;text-align:center;">
            Este resumen se genera automáticamente el 1° de cada mes para el mes anterior.
          </p>
        `),
      }

    case 'admin-resumen':
      return {
        subject: `[${APP_NAME}] Resumen diario billing — ${new Date().toLocaleDateString('es-AR')}`,
        html: layout('Resumen billing', `
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:300;color:#2C2C2C;">Resumen diario</h1>
          <p style="margin:0 0 8px;font-size:13px;color:#6B5B52;">Procesados: <strong>${data.totalProcessed}</strong></p>
          ${(data.changes as { studioName: string; action: string }[]).length > 0 ? `
            <p style="margin:16px 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;">Cambios</p>
            ${(data.changes as { studioName: string; action: string }[]).map((c) =>
              `<p style="margin:0 0 4px;font-size:13px;color:#2C2C2C;">• ${c.studioName}: ${c.action}</p>`
            ).join('')}
          ` : '<p style="margin:16px 0 0;font-size:13px;color:#9E8E82;">Sin cambios hoy.</p>'}
          ${(data.errors as { studioName: string; error?: string }[]).length > 0 ? `
            <p style="margin:16px 0 8px;font-size:12px;font-weight:600;color:#C4774A;text-transform:uppercase;">Errores</p>
            ${(data.errors as { studioName: string; error?: string }[]).map((e) =>
              `<p style="margin:0 0 4px;font-size:13px;color:#C4774A;">• ${e.studioName}: ${e.error}</p>`
            ).join('')}
          ` : ''}
        `),
      }

    case 'nuevo-alumno-admin':
      return {
        subject: `Nueva alumna en ${data.studioName}: ${data.studentName}`,
        html: layout('Nueva alumna', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Nueva alumna registrada</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, <strong>${data.studentName}</strong> se acaba de registrar en <strong>${data.studioName}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Alumna</p>
                <p style="margin:0;font-size:14px;color:#2C2C2C;">${data.studentName}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#6B5B52;">Podés verla en el panel de alumnos y asignarle un paquete cuando corresponda.</p>
        `),
      }

    case 'bienvenida-alumno':
      return {
        subject: `¡Bienvenida a ${data.studioName}!`,
        html: layout('Bienvenida', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">
            ¡Hola, ${data.studentName}!
          </h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Tu cuenta en <strong>${data.studioName}</strong> fue creada exitosamente.
            Ya podés reservar tus clases desde la app.
          </p>
          <p style="margin:0;font-size:13px;color:#9E8E82;">
            Si tenés alguna consulta, contactate directamente con el estudio. ¡Te esperamos!
          </p>
        `),
      }

    case 'clase-cancelada-alumna':
      return {
        subject: `Clase cancelada — ${data.className}`,
        html: layout('Clase cancelada', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Clase cancelada</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;">
            Hola ${data.studentName}, el estudio canceló la siguiente clase:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Detalle</p>
                <p style="margin:0 0 4px;font-size:14px;color:#2C2C2C;"><strong>${data.className}</strong></p>
                <p style="margin:0;font-size:13px;color:#6B5B52;">${data.date} · ${data.time}</p>
              </td>
            </tr>
          </table>
          ${data.creditsRefunded
            ? `<p style="margin:0;font-size:13px;color:#5C7A5E;">✓ Tu crédito fue devuelto automáticamente.</p>`
            : `<p style="margin:0;font-size:13px;color:#9E8E82;">Estabas en lista de espera — no se consumió ningún crédito.</p>`
          }
        `),
      }

    case 'pago-aprobado':
      return {
        subject: `Pago confirmado — ${data.packageName}`,
        html: layout('Pago confirmado', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">¡Pago confirmado!</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;">
            Hola ${data.studentName}, tu pago fue procesado correctamente.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Tu paquete</p>
                <p style="margin:0 0 4px;font-size:14px;color:#2C2C2C;"><strong>${data.packageName}</strong></p>
                <p style="margin:0 0 4px;font-size:13px;color:#6B5B52;">${data.classesTotal} clases</p>
                <p style="margin:0;font-size:13px;color:#6B5B52;">Vence el ${data.expiresAt}</p>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#5C7A5E;">✓ Ya podés reservar tus clases en ${data.studioName}.</p>
        `),
      }

    case 'grace-cutoff-admin':
      return {
        subject: `[${data.studioName}] Alumnos con reservas impagas — período de gracia vencido`,
        html: layout('Período de gracia vencido', `
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:300;color:#2C2C2C;">Período de gracia vencido</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#6B5B52;line-height:1.6;">
            Hola ${data.adminName}, el corte del período de gracia de <strong>${data.studioName}</strong> procesó
            <strong>${data.studentCount} alumna${(data.studentCount as number) !== 1 ? 's' : ''}</strong> con reservas pendientes de pago.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="background:#F7F3EE;border-radius:12px;padding:16px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#9E8E82;text-transform:uppercase;letter-spacing:0.08em;">Alumnas afectadas</p>
                ${(data.students as { name: string; bookingCount: number }[]).map((s) =>
                  `<p style="margin:0 0 4px;font-size:13px;color:#2C2C2C;">• ${s.name} — ${s.bookingCount} reserva${s.bookingCount !== 1 ? 's' : ''}</p>`
                ).join('')}
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#6B5B52;">
            Sus reservas futuras fueron mantenidas (política KEEP_AND_ALERT). Revisá el panel de alumnos para gestionar los pagos pendientes.
          </p>
        `),
      }

    default:
      return {
        subject: `[${APP_NAME}] Notificación`,
        html: layout('Notificación', `<p style="font-size:14px;color:#6B5B52;">Notificación del sistema.</p>`),
      }
  }
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, unknown> = {},
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { subject, html } = renderTemplate(template, data)
    const result = await getResend().emails.send({ from: FROM, to, subject, html })

    if (result.error) {
      console.error(`[email] Error sending ${template} to ${to}:`, result.error)
      return { success: false, error: result.error.message }
    }

    console.log(`[email] Sent ${template} to ${to} (id=${result.data?.id})`)
    return { success: true, id: result.data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[email] Exception sending ${template} to ${to}:`, msg)
    return { success: false, error: msg }
  }
}
