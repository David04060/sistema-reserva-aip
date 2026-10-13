# Frontend del Sistema de Reservas AIP

Consultar el [README general](../README.md) para instalación y reglas del sistema, y [CLOUDFLARE.md](CLOUDFLARE.md) para contratos D1, autenticación y preparación de producción.

## Desarrollo Cloudflare

Desde esta carpeta, instalar con `npm ci`, copiar `.dev.vars.example` a `.dev.vars` y sustituir sus valores de ejemplo de `ADMIN_PASSWORD` y `JWT_SECRET`. Usar un secreto JWT aleatorio de al menos 32 bytes.

```powershell
npm run db:init:local
npm run dev
```

Vite sirve React y `/api` desde el mismo origen, normalmente `http://localhost:5173`. D1 local se inicializa con `schema.sql` y se guarda bajo `.wrangler/`. El Worker no accede a la base SQLite original. El puerto es estricto.

## Desarrollo con Express

Configurar `VITE_API_URL=http://localhost:3000` en `.env.express.local` y ejecutar:

```powershell
npm run dev:express
```

Iniciar también el backend Express desde la raíz con `npm run dev:backend`. El plugin Cloudflare se desactiva en modo `express`. El comando raíz `npm run dev:frontend` usa este modo para conservar el desarrollo original.

`src/config/api.ts` usa `VITE_API_URL` únicamente en modo `express`. En modo Cloudflare y en la compilación habitual de producción siempre usa `/api`.

## Comandos

| Comando desde frontend            | Uso                                                                        |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                     | React + Worker mediante el plugin Cloudflare.                              |
| `npm run dev:express`             | Interfaz conectada a Express.                                              |
| `npm run db:init:local`           | Aplicar el esquema a D1 local; no usa `--remote`.                          |
| `npm run build`                   | Comprobar TypeScript y compilar Worker y assets.                           |
| `npm run build -- --mode express` | Compilar la interfaz para Express.                                         |
| `npm run preview`                 | Vista previa local de la compilación habitual.                             |
| `npm run lint`                    | Revisar el código con la configuración común.                              |
| `npm test`                        | Compilar mediante `pretest` y ejecutar las 14 pruebas de frontend/Workers. |
| `npm run test:worker`             | Compilar y ejecutar las 8 pruebas Workers.                                 |

Desde la raíz, `npm run check` valida backend, frontend, Worker, pruebas y formato.

## Compilación y rutas SPA

La compilación Cloudflare genera:

- `dist/client`: `index.html`, JavaScript y CSS de React.
- `dist/sistema_reserva_aip/index.js`: Worker compilado.
- `dist/sistema_reserva_aip/wrangler.json`: configuración generada para Wrangler.

`wrangler.jsonc` usa `ASSETS` con `single-page-application`. `/api` y `/api/*` ejecutan primero el Worker; una API desconocida devuelve JSON 404. Las rutas `/`, `/horario`, `/admin` y otras rutas SPA reciben `index.html` para que React Router resuelva la navegación. La protección administrativa efectiva está en la API.

El modo de compilación `express` genera la salida estática en `dist`. El servidor que la publique debe resolver las rutas SPA hacia `index.html`.

## Archivos y responsabilidades

| Ruta                     | Responsabilidad                                          |
| ------------------------ | -------------------------------------------------------- |
| `src/pages`              | Inicio, horario y administración.                        |
| `src/components`         | Componentes compartidos.                                 |
| `src/domain/horario.ts`  | Bloques y agrupación sin atravesar recesos.              |
| `src/lib`                | Lectura HTTP y fechas en Lima.                           |
| `src/config/api.ts`      | API del mismo origen o URL del modo Express.             |
| `src/App.css`            | Estilos existentes y ajustes móviles.                    |
| `worker/index.ts`        | API D1, login JWT, autorización y errores.               |
| `schema.sql`             | Tabla reservas, índices y triggers de exclusión.         |
| `wrangler.jsonc`         | DB, ASSETS, ADMIN_LOGIN_LIMITER y logs.                  |
| `vite.config.ts`         | Plugins React y Cloudflare según el modo.                |
| `tsconfig.worker.json`   | Comprobación de tipos del Worker.                        |
| `tests/horario.test.mjs` | 6 pruebas de agrupación, HTTP y fechas.                  |
| `tests/worker.test.mjs`  | 8 pruebas de API, D1, concurrencia, autenticación y SPA. |

Workers reutiliza `../backend/src/domain/reservas.ts`; las reglas no se duplican. El bundle Workers no ejecuta Express, better-sqlite3, fs ni `app.listen`.

## Seguridad y validación

Los secretos locales van en `.dev.vars`; los remotos, en secretos de Cloudflare. No incluir secretos en variables `VITE_`, React, documentación o Git. JWT usa HS256, rol administrador y expiración de dos horas. El login limita a 5 intentos por IP cada 60 segundos y devuelve 429; los accesos desde otro Origin se rechazan sin CORS permisivo.

La validación de la adaptación aprobó 14 pruebas de frontend/Workers y las 15 del backend original. También se aplicó el esquema a D1 local y se comprobó el paquete con `wrangler deploy --dry-run`. El trigger D1 y el rollback se probaron con SQL directo y peticiones simultáneas.

No se desplegó a producción ni se validó D1 remoto. La migración de datos locales, los secretos remotos, las cuotas gratuitas y la comprobación del entorno remoto quedan descritos en [CLOUDFLARE.md](CLOUDFLARE.md).
