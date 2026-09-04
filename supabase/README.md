# Conexión de solicitudes del portal

Esquema confirmado con el CSV del usuario: `Clientes`, `Sistemas`, `Maintainance`, `Documentos`.
Se conservan sus nombres exactos; no se modifican ni se publican datos de `Clientes`.

## Flujo implementado

QR `/s/{public_token}` → RPC `get_public_system` → expediente público limitado.

Formulario → `/api/client-requests` → RPC `submit_client_request` → `client_requests`.
La segunda migración asigna un UUID aleatorio a cada fila de `Sistemas`. La función resuelve
internamente `Sistemas.id` y `Clientes.id`; el navegador nunca recibe datos personales.

| Formulario | Parámetro RPC | Columna de solicitud |
| --- | --- | --- |
| QR de vivienda | p_public_token | system_id + system_record_id resuelto en SQL |
| Solicitud / falla | p_request_type | request_type |
| Comentarios | p_message | message |
| Fecha preferida | p_preferred_date | preferred_date |

El nombre, teléfono y correo se copian internamente desde el cliente vinculado para facilitar
el seguimiento; no se solicitan ni se exponen en la app. Una solicitud no crea un registro
en `Maintainance`: esa tabla es para servicios ya documentados.

## Activación

1. Ejecutar las dos migraciones, en orden, en SQL Editor de Supabase.
2. Verificar que cada `Sistemas.client_id` apunte a un cliente con nombre y teléfono.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   en `.env.local` y también en el entorno Preview de Vercel antes de desplegar.
4. Consultar `system_code`, `public_token` y `qr_path` con la consulta al final de la segunda migración.
5. Reiniciar el servidor local. Abrir el `qr_path`, probar y comprobar el folio en `client_requests`.

## Límites actuales

- La clave pública solo ejecuta la función de envío; no permite consultar solicitudes.
- La función valida el sistema y los campos, y frena envíos repetidos con el mismo teléfono
  al mismo sistema durante cinco minutos. Esto no reemplaza protección antibots completa.
- Las políticas de lectura/cambio de estado exigen `app_metadata.role = admin`.
  La autenticación y la bandeja de solicitudes del panel todavía deben implementarse.
- La ruta `FV-0001` es solo demostrativa. Las rutas UUID leen datos reales limitados.
- Antes de uso con clientes reales: revisar RLS de las tablas existentes, acceso al expediente
  (el código secuencial no es un secreto), aviso de privacidad y protección contra abuso.

No colocar claves `service_role` o `sb_secret_...` en el frontend ni en Git.
