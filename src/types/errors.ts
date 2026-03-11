export type BookingError =
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

export class AppError extends Error {
  constructor(
    public code: BookingError,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'AppError'
  }
}
