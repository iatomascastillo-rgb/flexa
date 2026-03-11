import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      studioId: string
    }
  }

  interface User {
    role: Role
    studioId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    studioId: string
  }
}
