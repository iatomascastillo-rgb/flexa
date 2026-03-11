# /screen — Crear pantalla mobile-first

Cuando el usuario invoca /screen [nombre], creá el componente siguiendo el sistema de diseño del proyecto.

## Sistema de diseño

### Paleta de colores
```css
--sage:       #5C7A5E   /* color principal, botones primarios */
--sage-light: #C4D4C6   /* fondos suaves, bordes */
--sage-pale:  #EAF0EA   /* backgrounds de sección */
--terracotta: #C4774A   /* acentos, alertas suaves, CTAs secundarios */
--terra-pale: #F5E6DC   /* fondo de notificaciones */
--charcoal:   #2C2C2C   /* texto principal */
--cream:      #F7F3EE   /* fondo general de la app */
```

### Tipografía
```css
font-family: 'Cormorant Garamond'  /* títulos, números grandes */
font-family: 'DM Sans'             /* UI, botones, labels */
```

### Estructura de pantalla
```tsx
// Server Component por defecto — usar 'use client' solo si hay interactividad
export default async function NombrePantalla() {
  // Datos del servidor
  const session = await getServerSession()
  const { studioId } = await getTenant()  // del middleware
  
  return (
    <main className="min-h-screen bg-[#F7F3EE] pb-24">
      {/* Contenido */}
      <BottomNav active="nombre" />  {/* nav fija abajo */}
    </main>
  )
}
```

### Componentes estándar de la app

**Créditos disponibles (Home):**
```tsx
<div className="bg-white rounded-2xl p-6 shadow-sm">
  <p className="text-sm text-[#757575] font-['DM_Sans']">Clases disponibles</p>
  <p className="text-6xl font-['Cormorant_Garamond'] font-bold text-[#5C7A5E]">8</p>
  <div className="w-full bg-[#EAF0EA] rounded-full h-2 mt-2">
    <div className="bg-[#5C7A5E] h-2 rounded-full" style={{width: '100%'}} />
  </div>
</div>
```

**Slot de clase:**
```tsx
// Verde: lugares disponibles | Naranja: casi llena | Rojo: llena
<button className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#C4D4C6]">
  <div>
    <p className="font-semibold text-[#2C2C2C]">16:00 — Reformer Básico</p>
    <p className="text-sm text-[#757575]">4/6 lugares</p>
  </div>
  <span className="text-[#5C7A5E] font-semibold text-sm">Reservar →</span>
</button>
```

**Botón primario:**
```tsx
<button className="w-full bg-[#5C7A5E] text-white py-4 rounded-2xl font-['DM_Sans'] font-semibold text-base active:opacity-90 transition-opacity">
  Reservar — 1 crédito
</button>
```

**Nav inferior:**
```tsx
// 4 tabs: Inicio · Clases · Recurrencia · Perfil
// Ícono activo en sage, inactivos en gris
```

## Reglas de UX
- Mobile-first — diseñar para 375px de ancho mínimo
- Tap targets mínimo 44x44px
- Estados de carga siempre (skeleton o spinner)
- Estados vacíos con mensaje claro y acción
- Errores con texto humano, no códigos técnicos
