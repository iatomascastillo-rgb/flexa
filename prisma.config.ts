import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Prisma CLI no carga .env.local automáticamente (eso es convención de Next.js)
config({ path: path.join(process.cwd(), '.env.local') })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },
})
