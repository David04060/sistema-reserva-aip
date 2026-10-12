# Sistema de Reservas AIP

Aplicación para reservar el Aula de Innovación Pedagógica de lunes a viernes. Incluye calendario, selección de bloques de 40 minutos, formulario de reserva y administración con búsqueda.

## Requisitos e instalación

Usar Node.js 24 o posterior. Desde la raíz:

```powershell
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

Crear `backend/.env` a partir de `backend/.env.example`. Configurar `ADMIN_PASSWORD` y `JWT_SECRET` con valores propios. No publicar los archivos `.env` ni la base de datos.

## Desarrollo

Abrir dos terminales en la raíz del proyecto:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

El backend usa `http://localhost:3000` y el frontend `http://localhost:5173`. El puerto de Vite es estricto para evitar que cambie silenciosamente a un origen no permitido por CORS.

## Configuración

| Variable         | Ubicación       | Uso                                                                                     |
| ---------------- | --------------- | --------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD` | `backend/.env`  | Contraseña del administrador.                                                           |
| `JWT_SECRET`     | `backend/.env`  | Secreto aleatorio para firmar sesiones de dos horas.                                    |
| `PORT`           | `backend/.env`  | Puerto del API; por defecto 3000.                                                       |
| `FRONTEND_URL`   | `backend/.env`  | Origen exacto permitido; por defecto `http://localhost:5173`.                           |
| `DATABASE_PATH`  | `backend/.env`  | Ruta de SQLite; por defecto `backend/database.sqlite`.                                  |
| `VITE_API_URL`   | `frontend/.env` | URL del API cuando está en otro origen. Requiere reconstruir el frontend en producción. |

El backend carga su `.env` y encuentra su base predeterminada aunque se arranque desde otra carpeta. Las fechas se validan y muestran usando America/Lima. La base existente se conserva y se migra para soportar grupos de reserva.

## Comprobación del proyecto

```powershell
npm run check
```

Este comando compila ambos proyectos, revisa el código, ejecuta las pruebas y comprueba el formato. Las pruebas del servidor usan una base SQLite en memoria y no cambian las reservas existentes.

- `npm run format`: aplicar el formato común.
- `npm test`: ejecutar pruebas de backend y frontend.
- `npm run build`: generar los directorios `dist`.
- `npm --prefix backend start`: iniciar el backend compilado.

## Organización

- `frontend/src/pages`: inicio, horario y administración.
- `frontend/src/components`: componentes compartidos de la interfaz.
- `frontend/src/domain`: bloques de clase y agrupación de selecciones.
- `frontend/src/lib`: lectura de respuestas HTTP y presentación de fechas.
- `backend/src/domain`: validación de datos, fechas y horarios.
- `backend/src/routes`: rutas HTTP y transacciones de reserva.
- `backend/src/middleware`: autorización del administrador.
- `backend/tests` y `frontend/tests`: pruebas automatizadas.

## Comportamiento de las reservas

El nombre del docente se guarda y lee en `sessionStorage`. Los bloques consecutivos se agrupan sin atravesar recesos. La validación devuelve 400 para datos inválidos y 409 para conflictos. La comprobación de disponibilidad y la inserción comparten una transacción inmediata para evitar reservas parciales o superpuestas.

La interfaz impide envíos repetidos, actualiza los horarios al elegir una fecha y después de guardar, y ofrece un reintento cuando falla la carga. Administración permite buscar sin distinguir tildes y elimina todos los bloques del grupo tras confirmación.

Después de desplegar cambios, reconstruir y reiniciar el backend y servir el `frontend/dist` generado. El servidor que sirva el frontend debe devolver `index.html` para las rutas de la aplicación.
