import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 días

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
        studioSlug: { label: 'Studio Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = String(credentials.email).trim().toLowerCase()
        const studioSlug = String(credentials.studioSlug ?? '').trim()

        // SUPER_ADMIN: login sin estudio
        if (!studioSlug) {
          const superAdmin = await prisma.user.findFirst({
            where: { email, role: 'SUPER_ADMIN' },
            select: {
              id: true, email: true, name: true, role: true, studioId: true,
              passwordHash: true, active: true, loginAttempts: true, lockedUntil: true,
            },
          })
          if (!superAdmin || !superAdmin.active) return null
          const now = new Date()
          if (superAdmin.lockedUntil && superAdmin.lockedUntil > now) return null
          const valid = await bcrypt.compare(String(credentials.password), superAdmin.passwordHash)
          if (!valid) return null
          return { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role, studioId: null }
        }

        const studio = await prisma.studio.findUnique({
          where: { slug: studioSlug, active: true },
          select: { id: true },
        })
        if (!studio) return null

        const user = await prisma.user.findUnique({
          where: {
            email_studioId: {
              email,
              studioId: studio.id,
            },
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            studioId: true,
            passwordHash: true,
            active: true,
            loginAttempts: true,
            lockedUntil: true,
          },
        })

        if (!user || !user.active) return null

        // ── Verificar bloqueo por intentos fallidos ───────────────────────────
        const now = new Date()
        if (user.lockedUntil && user.lockedUntil > now) {
          // Cuenta bloqueada — no revelar que la cuenta existe
          return null
        }

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash)

        if (!valid) {
          // Incrementar contador — bloquear a partir del 10° intento (15 min)
          const newAttempts = user.loginAttempts + 1
          const lockedUntil = newAttempts >= 10
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: newAttempts,
              ...(lockedUntil ? { lockedUntil } : {}),
            },
          }).catch(() => {})
          return null
        }

        // Login exitoso — resetear contador
        if (user.loginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockedUntil: null },
          }).catch(() => {})
        }

        // Lazy re-hash: migra hashes de cost=10 a cost=8 en el próximo login
        if (bcrypt.getRounds(user.passwordHash) > 8) {
          const newHash = await bcrypt.hash(String(credentials.password), 8)
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash },
          }).catch(() => {}) // silent fail — reintenta en el siguiente login
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          studioId: user.studioId,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        if (user.role) token.role = user.role
        if (user.studioId) token.studioId = user.studioId
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = (token.sub ?? token.id) as string
      if (token.role) session.user.role = token.role as Role
      if (token.studioId) session.user.studioId = token.studioId as string
      return session
    },
  },

  pages: {
    signIn: '/login',
  },
})
