# Solaris Maintenance Portal

Aplicación independiente para el portal de mantenimiento fotovoltaico.

## Áreas

- `/s/FV-0001`: demostración visual; no envía solicitudes.
- `/s/{public_token}`: aplicación real vinculada al QR único de una vivienda.
- `/admin`: previsualización del panel administrativo.
- `/api/client-requests`: recepción de solicitudes mediante Supabase.

La ruta real obtiene de Supabase únicamente los campos del expediente permitidos por la función
`get_public_system`; no expone clientes, direcciones, números de serie ni otras viviendas. Las solicitudes
se vinculan internamente al cliente del sistema, sin pedir nuevamente su nombre, teléfono o correo.

El panel administrativo continúa siendo una previsualización con datos de demostración.

## Desarrollo

1. Copia `.env.example` a `.env.local` y configura los valores públicos de Supabase.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. Ejecuta en orden las migraciones de `supabase/migrations`.
5. Obtén la ruta de cada QR mediante la consulta incluida al final de la segunda migración.
6. Abre `http://localhost:3000/s/FV-0001` para la demo o `/s/{public_token}` para una vivienda.

Nunca coloques una clave `service_role` o `sb_secret_...` en este proyecto.
