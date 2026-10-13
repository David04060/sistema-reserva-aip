# Adaptación de Reservas AIP a Workers + D1

Actualizado el **13 de octubre de 2026**. Véanse también el
[README general](../README.md) y el [README del frontend](README.md).

La interfaz y el backend Express original se conservan. El Worker importa únicamente
`backend/src/domain/reservas.ts`: las validaciones, horarios, recesos y fecha actual
en `America/Lima` son exactamente las mismas. No importa Express, better-sqlite3,
la configuración de dotenv ni la base SQLite original.

## Configuración actual

| Campo                                | Valor del repositorio                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| Worker                               | `sistema-reserva-aip`                                           |
| Entrada                              | `frontend/worker/index.ts`                                      |
| Fecha de compatibilidad              | `2026-10-12`                                                    |
| Binding D1                           | `DB`                                                            |
| Base D1                              | `reservas-aip-db`                                               |
| Identificador D1                     | `23367e02-f7bf-490c-a98d-cbe21876e641`                          |
| Assets                               | `ASSETS`, con fallback `single-page-application`                |
| Rutas que ejecutan primero el Worker | `/api`, `/api/*`                                                |
| Limitador                            | `ADMIN_LOGIN_LIMITER`, namespace `1001`, 5 intentos/60 segundos |
| Observabilidad                       | Logs habilitados, logs de invocación y persistencia habilitados |

El identificador de la base no es una contraseña; debe confirmarse que corresponde
a la cuenta prevista antes de operar remotamente. `ADMIN_PASSWORD` y `JWT_SECRET`
son secretos separados de esta configuración. El Worker no requiere `nodejs_compat`.
La observabilidad declarada no implica que el Worker esté desplegado ni que se
hayan comprobado sus logs en Cloudflare.

El frontend usa React 19, Vite 8 y TypeScript; se añadieron `jose`, tipos Workers,
esbuild y Miniflare para autenticación, tipos y pruebas. Miniflare usa la versión
5 beta compatible con la versión de Wrangler instalada. Los lockfiles fijan las
versiones utilizadas; revisar y repetir pruebas al actualizar estas herramientas.

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
`npm run dev:cloudflare` inicia el mismo desarrollo desde la raíz.
`npm run test:worker`, desde frontend, compila y ejecuta solo las ocho pruebas
Workers. `npm test` compila automáticamente mediante `pretest` antes de ejecutar
las seis pruebas de interfaz y las ocho de Workers.

La compilación habitual genera `frontend/dist/client` para React y
`frontend/dist/sistema_reserva_aip` para el Worker y la configuración Wrangler.
Wrangler utiliza la configuración de despliegue generada por Vite. El comando
`wrangler deploy --dry-run` solo valida el paquete, sin desplegarlo.

## Desarrollo original Express

Conservar `backend/.env` y la base SQLite actual. Desde la raíz, ejecutar
`npm run dev:backend` y `npm run dev:frontend` en terminales separadas.
El segundo usa el modo `express`; configurar `VITE_API_URL=http://localhost:3000`
en `frontend/.env.express.local`. El modo Cloudflare y la compilación de producción
siempre usan `/api`, aunque exista una variable VITE_API_URL antigua en `.env`.
Para compilar la interfaz para Express, ejecutar desde frontend
`npm run build -- --mode express`; su salida estática es `dist`.

## Integridad y contratos

Se conservan los ocho endpoints solicitados, con prefijo `/api`, las respuestas
JSON y los códigos del backend original. Ambas rutas de listado completo y las
eliminaciones requieren JWT HS256 con rol administrador y expiración. Los tokens
de login duran dos horas. Las consultas con entradas usan `prepare().bind()`.

### Endpoints y respuestas

| Método y ruta Workers                 | Autorización       | Respuesta correcta                                |
| ------------------------------------- | ------------------ | ------------------------------------------------- |
| `POST /api/admin/login`               | Contraseña en JSON | 200: `{ mensaje, token }`                         |
| `GET /api/reservas/publicas`          | Pública            | 200: array con día, fecha, inicio, fin y profesor |
| `POST /api/reservas`                  | Pública            | 201: `{ mensaje, grupoId, id }`                   |
| `POST /api/reservas/multiple`         | Pública            | 201: `{ mensaje, grupoId }`                       |
| `GET /api/reservas/admin`             | JWT administrador  | 200: array de filas completas                     |
| `GET /api/reservas`                   | JWT administrador  | 200: mismo listado administrativo                 |
| `DELETE /api/reservas/grupo/:grupoId` | JWT administrador  | 200: `{ mensaje, bloquesEliminados }`             |
| `DELETE /api/reservas/:id`            | JWT administrador  | 200: `{ mensaje }`                                |

Express conserva esas rutas sin `/api`. El login recibe `{ "password": "..." }`.
Las rutas administrativas reciben `Authorization: Bearer <token>`.
La verificación JWT acepta únicamente HS256, exige expiración y comprueba
`rol: "administrador"`. Una firma inválida o un token expirado devuelve 401;
un token firmado válido con otro rol devuelve 403.

Las reservas reciben `profesor`, `area`, `grado`, `seccion` y `fechaProgramada`.
La individual añade `horaInicio` y `horaFin`; la múltiple añade
`reservas: [{ horaInicio, horaFin }, ...]`. El servidor deriva `dia` de la fecha.
La reserva individual devuelve un ID numérico; el grupo usa un UUID. Las filas
administrativas contienen `id`, `grupo_id`, `profesor`, `area`, `grado`, `seccion`,
`dia`, `fecha_programada`, `hora_inicio`, `hora_fin` y `fecha_reserva`.
La respuesta pública solo incluye `dia`, `fecha_programada`, `hora_inicio`,
`hora_fin` y `profesor`: el nombre del docente sigue siendo público por contrato.

Los errores de API se entregan como `{ "mensaje": "..." }`:

| Código | Caso                                                            |
| ------ | --------------------------------------------------------------- |
| 400    | Campos, fecha, horario, ID, grupo o JSON inválidos              |
| 401    | Contraseña incorrecta, falta de autorización o sesión inválida  |
| 403    | Rol insuficiente u Origin distinto del origen de la API         |
| 404    | Ruta desconocida o reserva inexistente al eliminar              |
| 409    | Intervalos ocupados o superpuestos en el mismo envío            |
| 413    | Cuerpo superior a 100 KiB, también si no declara Content-Length |
| 429    | Limitador de login; incluye `Retry-After: 60`                   |
| 500    | Autenticación sin secretos o error interno                      |

La API devuelve JSON con `Cache-Control: no-store` y
`X-Content-Type-Options: nosniff`. Un Origin ajeno recibe 403; no se habilita
CORS permisivo. Las rutas API desconocidas no reciben el HTML de React.

### Reglas compartidas y esquema

Los horarios se mantienen en siete bloques: 13:00–13:40, 13:40–14:20,
14:20–15:00, 15:10–15:50, 15:50–16:30, 16:40–17:20 y 17:20–18:00.
Los recesos son 15:00–15:10 y 16:30–16:40. Solo la operación múltiple permite
unir bloques adyacentes y nunca permite atravesar un receso.

Se validan fechas reales `YYYY-MM-DD`, lunes a viernes, desde la fecha actual
de Lima. No se añade una restricción por hora actual a reservas del mismo día.
Profesor y área admiten hasta 100 caracteres, grado 30 y sección 20 después
de recortar espacios; todos son obligatorios. La operación múltiple admite entre
1 y 7 intervalos, los ordena y rechaza solapamientos internos con 409.

`schema.sql` crea la tabla `reservas`, un índice por fecha/horas, otro por grupo,
el trigger de INSERT y el trigger de UPDATE. La tabla exige `grupo_id` no nulo
y `hora_inicio < hora_fin`. Las reglas escolares completas siguen en el validador
compartido; los triggers protegen la exclusión de intervalos en la base.

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

## Resultados de la validación realizada

- `npm run check`: compilación de ambos proyectos, lint, pruebas y formato aprobados.
- 29 pruebas aprobadas: 15 Express, 6 de interfaz y 8 Workers.
- 12 solicitudes simultáneas al mismo bloque: exactamente una respuesta 201 y once 409.
- Grupos concurrentes: solo el grupo ganador queda guardado; el segundo INSERT
  conflictivo revierte el primer INSERT de un batch.
- Los triggers reales del esquema rechazan INSERT/UPDATE SQL directos que solapan
  y permiten intervalos adyacentes en D1 local.
- Wrangler aplicó las cinco sentencias de `schema.sql` a la base local correctamente.
- `wrangler deploy --dry-run` verificó assets y bindings DB, ASSETS y
  ADMIN_LOGIN_LIMITER sin realizar un despliegue.
- La auditoría npm del frontend terminó sin vulnerabilidades informadas en esa ejecución.

No se consultaron ni modificaron la base remota o los secretos remotos. No se
migraron las reservas de SQLite a D1. La comprobación local no mide CPU remoto,
cuotas reales de la cuenta ni el comportamiento del limitador entre ubicaciones.
Los resultados corresponden a la adaptación validada; repetir los controles
después de cambios de código o dependencias.

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
