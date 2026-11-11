# Pura Suerte — casino social (fase 1)

Casino social con monedas virtuales: **no se apuesta dinero real y las monedas no se canjean por dinero ni premios**. Web app instalable (PWA), pensada para celular.

## Qué incluye

| Parte | Estado |
| --- | --- |
| Registro con correo (enlace mágico) y Google, verificación de 18+ | Listo (Google y correo real se activan con sus claves) |
| Billetera con libro contable inmutable y bloqueo de saldo | Listo |
| **Tesoro Maya** — slot 5×3, 20 líneas, templo de giros gratis, RTP 96.2% | Listo |
| **Cohete** — crash individual, retiro manual o automático, ronda verificable (hash/semilla), RTP 96% | Listo |
| Rueda diaria, regalo cada 4 h, misión diaria, anuncio con recompensa | Listo (el anuncio es simulado hasta conectar la red de anuncios) |
| Tienda: oferta de bienvenida, 5 paquetes, límite de compra diario | Listo en modo prueba (falta pasarela de pago) |
| Torneo semanal y "Ganando ahora" con datos reales | Listo |
| Los otros 8 juegos | Aparecen como "Próximamente" |

## Estructura

```
server/   API en Node + Fastify + PostgreSQL (TypeScript)
  src/games/slot.ts     matemática de Tesoro Maya (RTP exacto con theoreticalRtp())
  src/games/crash.ts    matemática de Cohete
  src/config.ts         bonos, paquetes y precios: todo lo que se ajusta seguido
  src/db/schema.sql     tablas (se crean solas al arrancar)
web/      Frontend React + Vite (PWA)
```

## Correr en tu compu

Necesitas Node 20+ y PostgreSQL.

```bash
npm run install:all
cp .env.example .env            # y llena DATABASE_URL
npm run build                   # compila el frontend
DATABASE_URL=... PAYMENTS_MODE=demo npm start
```

Abre http://localhost:3000. Sin `RESEND_API_KEY`, el enlace de acceso aparece en pantalla como "Abrir enlace (modo desarrollo)" y en la consola del servidor.

Para desarrollar con recarga en vivo: `npm --prefix server run dev` y en otra terminal `npm --prefix web run dev` (abre http://localhost:5173).

Pruebas de la matemática de los juegos: `npm test` (incluye simulación de 400,000 giros).

## Desplegar en Railway

1. Sube el repo a GitHub (privado).
2. En Railway: nuevo proyecto → desde el repo. Usa el `Dockerfile` incluido.
3. Agrega un servicio PostgreSQL y pasa su `DATABASE_URL` al servicio web.
4. Variables: `PUBLIC_URL`, `NODE_ENV=production`, y cuando las tengas `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM`.
5. Deja `PAYMENTS_MODE=off` en producción hasta conectar la pasarela.

## Pendientes antes de abrir al público

- Pasarela de pago (Stripe) para los paquetes de monedas, con webhook que acredite la compra.
- Red de anuncios con recompensa y validación del lado del servidor.
- Páginas de Términos y Política de privacidad (los enlaces ya están en el registro).
- Nombre de marca definitivo y revisión de que no esté registrado.
- Los otros 8 juegos.
