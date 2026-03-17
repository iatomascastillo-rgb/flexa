import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 24 * 60 * 60 }, // 60 días

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
        studioSlug: { label: 'Studio Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.studioSlug) {
          return null
        }

        const studio = await prisma.studio.findUnique({
          where: { slug: String(credentials.studioSlug), active: true },
          select: { id: true },
        })
        if (!studio) return null

        const user = await prisma.user.findUnique({
          where: {
            email_studioId: {
              email: String(credentials.email),
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
          },
        })

        if (!user || !user.active) return null

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash)
        if (!valid) return null

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
