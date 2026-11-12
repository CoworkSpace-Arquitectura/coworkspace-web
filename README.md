# CoworkSpace · Sitio web

Sitio para los miembros y la administración de CoworkSpace. Está hecho con Next.js como sitio estático y habla **solo con el API Gateway**: nunca llama directamente a un microservicio.

| Página | Qué muestra | Servicios que intervienen |
| --- | --- | --- |
| Sedes | Sedes por país de destino | Space, Currency |
| Sede | Salas y puestos con precio en la moneda de la sede y en la del visitante; reserva | Space, Currency, Booking, Membership |
| Pago | Regreso desde Stripe y confirmación de la reserva | Billing, Booking (Saga) |
| Planes | Suscribirse y cancelar | Membership |
| Mis reservas | Reservas, pago pendiente y cancelación | Booking, Billing |
| Credencial | Código QR y simulador de la puerta | Access Control |
| Comunidad | Perfil, directorio y encuentros | Community |
| Avisos | Notificaciones del miembro | Notification |
| Panel | Estado de los servicios y métricas | Gateway, Analytics |

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # en Windows: copy .env.example .env.local
npm run dev                  # http://localhost:3010
```

`NEXT_PUBLIC_API_URL` es la dirección del API Gateway, sin `/` al final.

## Producción

Render, *Static Site*: build `npm ci && npm run build`, carpeta publicada `out`, variable `NEXT_PUBLIC_API_URL=https://coworkspace-gateway.onrender.com/api`.
