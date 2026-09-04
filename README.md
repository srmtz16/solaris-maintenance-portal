# Solaris Maintenance Portal

Aplicación independiente para el portal de mantenimiento fotovoltaico.

## Áreas

- `/s/FV-0001`: portal público del cliente.
- `/admin`: previsualización del panel administrativo.
- `/api/client-requests`: recepción de solicitudes mediante Supabase.

El expediente, el historial, los documentos y el panel administrativo utilizan datos de demostración.
Las solicitudes de mantenimiento y los reportes de falla se guardan en Supabase cuando las variables
de entorno están configuradas y se ha ejecutado la migración incluida.

## Desarrollo

1. Copia `.env.example` a `.env.local` y configura los valores públicos de Supabase.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. Abre `http://localhost:3000/s/FV-0001`.

Nunca coloques una clave `service_role` o `sb_secret_...` en este proyecto.
