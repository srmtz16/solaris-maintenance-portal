# Reportes de servicio

En `/admin/clientes/{systemCode}`, abre **Mantenimientos / Servicios → Nuevo servicio**.
Captura los ocho pasos, guarda el borrador, confirma los datos y genera la vista previa.
El PDF que ves es el mismo archivo que se guarda y descarga. **Finalizar servicio**
lo publica en Documentos y registra el mantenimiento en el historial del cliente.
Los servicios finalizados quedan bloqueados; sus PDF anteriores se conservan.

## Instalación

1. Instalar dependencias con `npm ci`.
2. Aplicar `supabase/migrations/202609210013_service_reports.sql` después de las migraciones existentes.
3. Publicar en Vercel con las variables públicas de Supabase ya configuradas.
4. Opcional: configurar `OPENAI_API_KEY` como secreto de servidor en Vercel y volver a desplegar.
   Nunca usar el prefijo `NEXT_PUBLIC_` para esta clave. `OPENAI_REPORT_MODEL` es opcional.

Los reportes manuales funcionan sin OpenAI. Las propuestas de IA requieren revisión
antes de aplicarse. Solo se envían las notas del técnico; no fotos ni datos de contacto.
La API tiene un límite de una solicitud por minuto y 40 por administrador cada 24 horas.

La evidencia de borradores y las versiones se guardan en el bucket privado
`service-evidence`. Al finalizar se publica una copia del PDF en el almacenamiento
existente `system-documents`, respetando el acceso actual mediante el Pasaporte Solar.
El QR del documento usa la ruta real `/s/{public_token}`.

El repositorio no contiene un archivo de logo oficial. El PDF usa el nombre de la
empresa en texto; el generador admite un recurso de logo cuando se incorpore el oficial.

## Verificación

- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- `tests/service-report-db.sql` comprueba autorización, borradores, concurrencia,
  versiones, finalización y vínculo al expediente en una transacción que revierte sus datos.
- Revisar visualmente un PDF largo con fotografías antes de actualizar el generador.
  La versión del generador está fijada: la versión 4.9.0 no imprimió los números de página
  durante las pruebas; 4.3.1 sí pasó la comprobación de cuatro páginas.
