# Sistema de Reservas AIP

Aplicación existente para reservar el Aula de Innovación Pedagógica de lunes a viernes. Incluye calendario, selección de bloques, formulario de reserva y administración con búsqueda. Se conserva la interfaz y el backend Express con SQLite, y se incorpora una versión compatible con Cloudflare Workers + D1.

Documentación actualizada el **13 de octubre de 2026**. La adaptación se validó localmente; no se ejecutó un despliegue a producción, SQL remoto ni configuración remota de secretos durante este trabajo.

## Requisitos e instalación

Usar Node.js 24 o posterior. Desde la raíz:

```powershell
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

El frontend usa React 19, TypeScript y Vite 8. Workers se integra mediante `@cloudflare/vite-plugin` y Wrangler; JWT usa `jose`. Las versiones reproducibles están en los archivos `package-lock.json`.

## Desarrollo con Cloudflare

Desde la raíz:

```powershell
Copy-Item frontend/.dev.vars.example frontend/.dev.vars
```

Editar `frontend/.dev.vars` y sustituir los valores de ejemplo de `ADMIN_PASSWORD` y `JWT_SECRET`. Usar un secreto JWT aleatorio de al menos 32 bytes.

```powershell
npm --prefix frontend run db:init:local
npm run dev:cloudflare
```

El frontend y la API `/api` comparten el origen de Vite, normalmente `http://localhost:5173`. La base D1 de desarrollo se almacena bajo `frontend/.wrangler/`; es independiente de `backend/database.sqlite`. El puerto de Vite es estricto.

Consultar [la guía Cloudflare](frontend/CLOUDFLARE.md) para configuración, contratos, pruebas y preparación de producción.

## Desarrollo original con Express

Crear `backend/.env` a partir de `backend/.env.example` y configurar sus secretos. Crear `frontend/.env.express.local` con:

```dotenv
VITE_API_URL=http://localhost:3000
```

Abrir dos terminales en la raíz:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

El backend usa `http://localhost:3000` y Vite `http://localhost:5173`. `dev:frontend` selecciona el modo `express`, sin el plugin Cloudflare. Express carga su `.env` y encuentra la base predeterminada aunque se arranque desde otra carpeta. Su base existente y la migración para grupos se conservan.

## Configuración y secretos

| Configuración                         | Ubicación                     | Uso                                                          |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `ADMIN_PASSWORD`, `JWT_SECRET`        | `backend/.env`                | Autenticación del backend Express.                           |
| `ADMIN_PASSWORD`, `JWT_SECRET`        | `frontend/.dev.vars`          | Autenticación del Worker local.                              |
| `ADMIN_PASSWORD`, `JWT_SECRET`        | Secretos de Cloudflare        | Autenticación futura del Worker remoto.                      |
| `PORT`                                | `backend/.env`                | Puerto de Express; por defecto 3000.                         |
| `FRONTEND_URL`                        | `backend/.env`                | Origen CORS de Express; por defecto `http://localhost:5173`. |
| `DATABASE_PATH`                       | `backend/.env`                | SQLite original; por defecto `backend/database.sqlite`.      |
| `VITE_API_URL`                        | `frontend/.env.express.local` | URL usada solo en modo `express`.                            |
| `DB`, `ASSETS`, `ADMIN_LOGIN_LIMITER` | `frontend/wrangler.jsonc`     | Bindings D1, assets SPA y limitador de login.                |

En modo Cloudflare y en la compilación de producción, la API siempre usa `/api`, incluso si existe una variable `VITE_API_URL` antigua. Nunca poner contraseñas ni secretos en React o variables `VITE_`. Los archivos locales de secretos, bases, `.wrangler` y artefactos generados están excluidos de Git.

## Horarios y validaciones compartidas

Las fechas usan `America/Lima`, deben ser reales, tener formato `YYYY-MM-DD`, corresponder a lunes a viernes y no ser anteriores a la fecha actual de Lima. Se permite reservar el día actual; la validación existente no compara el intervalo con la hora actual.

| Bloque | Inicio | Fin   |
| ------ | ------ | ----- |
| 1      | 13:00  | 13:40 |
| 2      | 13:40  | 14:20 |
| 3      | 14:20  | 15:00 |
| Receso | 15:00  | 15:10 |
| 4      | 15:10  | 15:50 |
| 5      | 15:50  | 16:30 |
| Receso | 16:30  | 16:40 |
| 6      | 16:40  | 17:20 |
| 7      | 17:20  | 18:00 |

Los campos obligatorios se recortan y aceptan hasta 100 caracteres para profesor y área, 30 para grado y 20 para sección. La reserva individual acepta un bloque; la múltiple acepta de 1 a 7 intervalos y permite unir bloques consecutivos sin atravesar recesos. Los solapamientos internos devuelven 409.

El Worker reutiliza directamente `backend/src/domain/reservas.ts`. En Express, disponibilidad e inserción comparten una transacción inmediata. En D1, `DB.batch()` y triggers SQL impiden solapamientos y revierten todo el grupo si falla una inserción. Las consultas con entradas usan parámetros.

El nombre del docente se guarda en `sessionStorage`. La interfaz agrupa bloques sin atravesar recesos, evita envíos repetidos, actualiza disponibilidad después de guardar y ofrece reintento ante errores de carga. Administración busca sin distinguir tildes y elimina el grupo tras confirmación.

## API y administración

Workers conserva los ocho endpoints actuales bajo `/api`; Express conserva las rutas equivalentes sin ese prefijo:

- `POST /api/admin/login`.
- `GET /api/reservas/publicas`.
- `POST /api/reservas`.
- `POST /api/reservas/multiple`.
- `GET /api/reservas/admin`.
- `GET /api/reservas`.
- `DELETE /api/reservas/grupo/:grupoId`.
- `DELETE /api/reservas/:id`.

Los listados completos y las eliminaciones requieren `Authorization: Bearer <token>`, firma HS256, rol administrador y expiración. Los tokens de login duran dos horas. El Worker usa `ADMIN_LOGIN_LIMITER`: 5 intentos por IP cada 60 segundos, incluidos logins exitosos, con HTTP 429. Express conserva 5 fallos por 15 minutos. Consultar los contratos y limitaciones en [CLOUDFLARE.md](frontend/CLOUDFLARE.md).

## Comprobación y resultados

```powershell
npm run check
```

Compila ambos proyectos, ejecuta lint sobre el código original y Workers, corre las pruebas y revisa el formato. La validación de la adaptación completó:

- 15 pruebas de backend Express y 14 de frontend/Workers: **29 pruebas aprobadas**.
- Concurrencia: 12 solicitudes al mismo bloque producen una reserva y 11 respuestas 409.
- Grupos concurrentes y rollback sin escrituras parciales; triggers probados con INSERT y UPDATE directos en D1 local.
- JWT, autorización, eliminación, login limitado, horarios, recesos, fechas, SPA y API del mismo origen.
- Aplicación de las cinco sentencias del esquema con Wrangler a D1 local.
- Empaquetado mediante `wrangler deploy --dry-run`, sin subir ni desplegar el Worker.
- Auditoría de dependencias del frontend al finalizar la adaptación: sin vulnerabilidades informadas en esa ejecución.

Las pruebas Express usan SQLite en memoria; las de Workers usan workerd/Miniflare con D1 efímero. Ninguna modifica las reservas originales. Estos resultados describen la comprobación realizada; no sustituyen una nueva ejecución tras cambios futuros.

## Comandos y salidas

| Comando desde la raíz                   | Resultado                                                          |
| --------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev:backend`                   | Express en desarrollo.                                             |
| `npm run dev:frontend`                  | React en modo Express.                                             |
| `npm run dev:cloudflare`                | React + Worker en desarrollo local.                                |
| `npm run build`                         | Backend compilado y frontend con Worker/assets.                    |
| `npm test`                              | Pruebas originales y Cloudflare; frontend compila antes de probar. |
| `npm run lint`                          | Revisión de backend, frontend, Worker y pruebas.                   |
| `npm run format`                        | Aplicar formato.                                                   |
| `npm run format:check`                  | Comprobar formato.                                                 |
| `npm --prefix backend start`            | Iniciar Express compilado.                                         |
| `npm --prefix frontend run test:worker` | Compilar y ejecutar solo pruebas Workers.                          |

La compilación habitual genera `backend/dist`, `frontend/dist/client` y `frontend/dist/sistema_reserva_aip`. El último contiene el Worker y la configuración Wrangler generada. No servir `frontend/dist` como si fuera la salida estática antigua: los assets están en `dist/client`.

Si se necesita generar el frontend para el backend Express original, ejecutar `npm --prefix frontend run build -- --mode express`. En ese modo, Vite genera `frontend/dist` y usa la URL configurada para Express. El servidor estático debe devolver `index.html` para rutas SPA.

## Organización

- `frontend/src/pages`: inicio, horario y administración.
- `frontend/src/components`: componentes comunes.
- `frontend/src/domain`: bloques y agrupación.
- `frontend/src/lib`: respuestas HTTP y fechas.
- `frontend/src/config/api.ts`: selección de URL de la API.
- `frontend/worker/index.ts`: API Workers y autorización.
- `frontend/schema.sql`: tabla, índices y triggers D1.
- `frontend/wrangler.jsonc`: bindings, SPA y observabilidad.
- `frontend/tsconfig.worker.json`: comprobación TypeScript de Workers.
- `backend/src/domain`: reglas compartidas de reservas.
- `backend/src/routes`, `backend/src/middleware`: rutas y autorización Express.
- `backend/tests`, `frontend/tests`: pruebas de ambos entornos.

## Pendientes antes de producción

Confirmar la cuenta y el identificador D1, configurar secretos, validar los triggers contra una D1 remota de pruebas y medir el comportamiento remoto antes del despliegue. La base local original no se migra automáticamente. Las cuotas del plan gratuito aplican y los listados completos crecen con el historial.

`wrangler.jsonc` habilita logs de invocación y persistencia; esa configuración todavía debe validarse en el entorno remoto. La guía [Cloudflare](frontend/CLOUDFLARE.md) detalla límites, migración de datos y pasos pendientes.
