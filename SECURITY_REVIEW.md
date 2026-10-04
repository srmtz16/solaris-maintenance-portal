# Revisión de seguridad de SOLARIS — 3 de octubre de 2026

## Alcance
Administrador, acceso de consulta, portal por QR, solicitudes, reportes y archivos; permisos de Supabase y dependencias del proyecto. Es una revisión del código y configuración disponibles, no una garantía de ausencia de vulnerabilidades.

## Hallazgos y cambios

- **Alto: función interna accesible sin sesión.** `service_snapshot` podía devolver datos del servicio y el identificador de acceso al expediente. La migración 018 retira su ejecución a `anon` y `authenticated`; también retira permisos anónimos de las funciones administrativas. No se ha determinado que haya ocurrido explotación.
- **Alto: roles antiguos en sesiones.** La migración 019 comprueba el rol vigente y la suspensión de la cuenta en todas las funciones administrativas y añade políticas restrictivas a tablas y almacenamiento. La cuenta de consulta conserva su acceso de solo lectura. El proxy consulta al servidor de autenticación y conserva las cookies renovadas al redirigir.
- **Alto: documentos publicados sin control de acceso al archivo.** Se preparó una ruta que comprueba la sesión o el QR exacto del expediente antes de emitir un enlace válido durante 60 segundos. La migración 020 verifica la relación documento/expediente. La activación del almacenamiento privado aún requiere configurar `SUPABASE_SERVICE_ROLE_KEY` en Vercel, publicar el código y probar un documento real antes de modificar la visibilidad del bucket. No se debe cerrar el bucket antes de esa prueba.
- **Endurecimiento web.** No enviar el enlace del expediente como Referer; impedir que otro sitio incruste el portal; impedir detección ambigua de tipos; excluir rutas privadas de buscadores. Las solicitudes JSON se limitan mientras se leen, incluso sin Content-Length. Las solicitudes del cliente requieren el origen del propio portal.
- **Dependencias.** Next.js y su configuración ESLint se actualizan a 16.3.6. El aviso GHSA-vcvr-r3jv-pc5j afecta a ImageResponse con SVG controlado por un atacante; no se encontró ese uso en SOLARIS. Se actualiza de todos modos. También se corrigieron versiones transitivas de brace-expansion.

## Validaciones

- Pruebas transaccionales en Supabase: todas las funciones administrativas rechazan una identidad inexistente con un JWT que afirma ser administrador; las tablas no devuelven datos; administrador vigente y consulta vigente mantienen acceso. La prueba revierte sus cambios.
- Prueba de documentos en Supabase: token ausente o incorrecto rechazado, token del expediente aceptado y documento inexistente rechazado. La prueba revierte sus cambios.
- Pruebas de aplicación cubren denegación antes de firmar archivos, duración del enlace, errores de almacenamiento, URL de destino inesperada, conservación de cookies, roles, límites de lectura y flujos existentes.
- Auditoría de dependencias de producción después de actualizar: **0 avisos**, a la fecha de esta revisión.
- Aviso pendiente de desarrollo: `braces` (GHSA-vfj7-8cjw-p6xm) y cuatro dependencias superiores aparecen en npm audit. Se usa en ESLint/fast-glob, sobre patrones del repositorio, no sobre entradas del cliente. El registro no ofrece corrección compatible; no se degradó Next/ESLint a la rama 14 ni se aplicó `--force`. No ejecutar patrones de repositorios no confiables con esta herramienta hasta tener una corrección.

## Activación pendiente de documentos privados

1. Guardar `SUPABASE_SERVICE_ROLE_KEY` como secreto de servidor en Production y Preview. Nunca usar un prefijo NEXT_PUBLIC ni guardar el valor en el repositorio.
2. Publicar y comprobar `/api/documents/<id>?token=<QR válido>` y la denegación con token ausente/incorrecto. Verificar administrador y consulta.
3. En una transacción, cambiar los enlaces devueltos por las tres funciones del portal a la ruta protegida y marcar `system-documents` como privado. El script de activación debe comprobar que no haya enlaces externos pendientes de migrar.
4. Verificar que un enlace público antiguo deje de funcionar, que el cliente siga viendo el archivo con su QR, y que la carga, el reporte, la vista previa y la eliminación conserven sus permisos.

Fuentes: [aviso oficial de Next.js](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [buckets privados de Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).
