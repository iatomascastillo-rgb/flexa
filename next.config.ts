import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Evita que la app sea embebida en iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Evita MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Solo envía el origen en el Referer (no la ruta completa)
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilita APIs del navegador que no se usan
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Fuerza HTTPS por 1 año (incluyendo subdominios)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
};

export default nextConfig;
