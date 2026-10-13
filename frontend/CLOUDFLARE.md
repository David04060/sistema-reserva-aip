# Adaptación de Reservas AIP a Workers + D1

La interfaz y el backend Express original se conservan. El Worker importa únicamente
`backend/src/domain/reservas.ts`: las validaciones, horarios, recesos y fecha actual
en `America/Lima` son exactamente las mismas. No importa Express, better-sqlite3,
la configuración de dotenv ni la base SQLite original.

## Desarrollo local Cloudflare

Desde `frontend`:

1. Ejecutar `npm ci`.
2. Copiar `.dev.vars.example` a `.dev.vars` y asignar una contraseña local y un
   JWT_SECRET aleatorio de al menos 32 bytes. Estos archivos están ignorados por Git.
3. Ejecutar `npm run db:init:local` para aplicar `schema.sql` a D1 local.
4. Ejecutar `npm run dev`. React y `/api` comparten el origen de Vite.
5. Ejecutar `npm test` para compilar y ejecutar las pruebas de frontend y Workers.

Las pruebas usan workerd/Miniflare y el binding D1, con base efímera independiente.
Aplican el mismo SQL de `schema.sql`, incluyendo los triggers completos. No usan
una simulación de consultas ni better-sqlite3. La configuración de assets y del
limitador se lee de `wrangler.jsonc`.

Desde la raíz, `npm run check` comprueba ambos backends, lint y formato.

## Desarrollo original Express

Conservar `backend/.env` y la base SQLite actual. Desde la raíz, ejecutar
`npm run dev:backend` y `npm run dev:frontend` en terminales separadas.
El segundo usa el modo `express`; configurar `VITE_API_URL=http://localhost:3000`
en `frontend/.env.express.local`. El modo Cloudflare y la compilación de producción
siempre usan `/api`, aunque exista una variable VITE_API_URL antigua en `.env`.

## Integridad y contratos

Se conservan los ocho endpoints solicitados, con prefijo `/api`, las respuestas
JSON y los códigos del backend original. Ambas rutas de listado completo y las
eliminaciones requieren JWT HS256 con rol administrador y expiración. Los tokens
de login duran dos horas. Las consultas con entradas usan `prepare().bind()`.

Cada creación usa `DB.batch()`, también para reservas individuales. El trigger
`impedir_reservas_superpuestas` verifica intervalos con extremos abiertos:
`hora_inicio < NEW.hora_fin AND hora_fin > NEW.hora_inicio`. Permite intervalos
adyacentes y prohíbe solapamientos parciales, iguales o contenidos. El trigger de
UPDATE protege cambios de mantenimiento. Un `RAISE(ABORT, 'HORARIO_OCUPADO')`
provoca rollback de todo el batch y HTTP 409. No se usa un SELECT previo como
garantía de exclusión; la consulta después de un conflicto solo obtiene el mensaje.

Pruebas: creación individual y grupal; disponibilidad pública sin detalles privados;
12 solicitudes simultáneas al mismo intervalo; grupos simultáneos; rollback cuando
el segundo INSERT falla; INSERT y UPDATE SQL directos; adyacencia; JWT expirado,
firma inválida y rol incorrecto; eliminación individual y grupal; límite de login;
recesos, fechas y Lima; SPA y API desconocida; origen, JSON inválido y cuerpo >100 KiB.

## Preparación futura de producción (no ejecutada)

Antes de desplegar, confirmar que el database_id de `wrangler.jsonc` pertenece a
la cuenta prevista. Aplicar el esquema y validar el trigger contra una D1 remota
de pruebas separada, sin modificar la base de producción. La ejecución local
verifica compatibilidad con el binding D1 pero no verifica la cuenta ni D1 remoto.

Configurar ADMIN_PASSWORD y JWT_SECRET con secretos de Cloudflare usando
`wrangler secret put ADMIN_PASSWORD` y `wrangler secret put JWT_SECRET`, en el
Worker/entorno correcto. Nunca usar variables VITE_ para secretos. No se han
ejecutado esos comandos ni un despliegue ni SQL remoto durante esta adaptación.

La base local original no se transfiere automáticamente a D1. Si se requiere
migrar reservas, hacer una copia, revisar datos y solapamientos existentes antes
de importar a una base separada. `CREATE TABLE IF NOT EXISTS` no cambia tablas ya
existentes ni su CHECK: una base previa exige una migración revisada.

El limitador preparado aplica 5 intentos por IP cada 60 segundos, incluyendo
logins exitosos; difiere del Express original (5 fallos en 15 minutos). Cloudflare
permite periodos de 10 o 60 segundos y sus contadores son locales a cada ubicación,
con consistencia eventual: no constituye un bloqueo global exacto.

Esta implementación usa D1, Static Assets y el binding de rate limiting, sin
servicios de pago adicionales. Las cuotas del plan gratuito siguen aplicándose:
al agotarlas, la API puede dejar de responder correctamente hasta el reinicio de
la cuota. Los listados conservan el contrato completo sin paginación, por lo que
su coste crece con el historial. No se ha medido CPU en la infraestructura remota.

Referencias: [batch D1 y rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[limitador](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/),
[plan Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[plan D1](https://developers.cloudflare.com/d1/platform/pricing/).
