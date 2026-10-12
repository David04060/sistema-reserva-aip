import { useEffect, useState } from "react";
import API_URL from "../config/api";
import { Link } from "react-router-dom";
import Marca from "../components/Marca";
import { leerRespuesta, mensajeError } from "../lib/http";
import { mostrarFecha, mostrarFechaReserva } from "../lib/fechas";

interface Reserva {
  id: number;
  grupo_id: string;
  profesor: string;
  area: string;
  grado: string;
  seccion: string;
  dia: string;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string;
  fecha_reserva: string;
}

interface ReservaAgrupada {
  grupo_id: string;
  profesor: string;
  area: string;
  grado: string;
  seccion: string;
  dia: string;
  fecha_programada: string;
  fecha_reserva: string;
  horarios: string[];
}

const CLAVE_SESION = "admin_authenticated";

const CLAVE_TOKEN = "admin_token";

function Admin() {
  const [password, setPassword] = useState("");

  const [autenticado, setAutenticado] = useState(
    () => sessionStorage.getItem(CLAVE_SESION) === "true" && !!sessionStorage.getItem(CLAVE_TOKEN),
  );

  const [token, setToken] = useState(() => sessionStorage.getItem(CLAVE_TOKEN) || "");

  const [reservas, setReservas] = useState<ReservaAgrupada[]>([]);

  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState("");
  const [errorCarga, setErrorCarga] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const filtradas = reservas.filter((reserva) =>
    `${reserva.profesor} ${reserva.area} ${reserva.grado} ${reserva.seccion} ${reserva.fecha_programada}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .includes(
        busqueda
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("es")
          .trim(),
      ),
  );

  const agruparReservas = (datos: Reserva[]): ReservaAgrupada[] => {
    const grupos = new Map<string, ReservaAgrupada>();

    datos.forEach((reserva) => {
      if (!grupos.has(reserva.grupo_id)) {
        grupos.set(reserva.grupo_id, {
          grupo_id: reserva.grupo_id,

          profesor: reserva.profesor,

          area: reserva.area,

          grado: reserva.grado,

          seccion: reserva.seccion,

          dia: reserva.dia,

          fecha_programada: reserva.fecha_programada,

          fecha_reserva: reserva.fecha_reserva,

          horarios: [],
        });
      }

      grupos.get(reserva.grupo_id)!.horarios.push(`${reserva.hora_inicio} - ${reserva.hora_fin}`);
    });

    return Array.from(grupos.values());
  };

  const cargarReservas = async (tokenAdministrador: string, signal?: AbortSignal) => {
    try {
      setCargando(true);
      setErrorCarga(false);

      const respuesta = await fetch(`${API_URL}/reservas/admin`, {
        method: "GET",
        signal,

        headers: {
          Authorization: `Bearer ${tokenAdministrador}`,
        },
      });

      const datos = await leerRespuesta<Reserva[] & { mensaje?: string }>(respuesta);
      if (signal?.aborted) return false;

      if (!respuesta.ok) {
        if (respuesta.status !== 401 && respuesta.status !== 403) {
          setErrorCarga(true);
          setAviso(datos.mensaje || "No se pudieron cargar las reservas.");
          return false;
        }

        sessionStorage.removeItem(CLAVE_SESION);

        sessionStorage.removeItem(CLAVE_TOKEN);

        setAutenticado(false);
        setToken("");

        setAviso(datos.mensaje || "La sesión de administrador ya no es válida.");

        return false;
      }

      if (!Array.isArray(datos)) throw new Error("El servidor devolvió reservas inválidas.");
      setReservas(agruparReservas(datos));

      return true;
    } catch (error) {
      if (signal?.aborted) return false;
      setErrorCarga(true);
      console.error(error);

      setAviso(mensajeError(error));

      return false;
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const sesionGuardada = sessionStorage.getItem(CLAVE_SESION);

    const tokenGuardado = sessionStorage.getItem(CLAVE_TOKEN);

    if (sesionGuardada === "true" && tokenGuardado) {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) return cargarReservas(tokenGuardado, controller.signal);
      });
    }

    return () => {
      controller.abort();
    };
  }, []);

  const ingresar = async () => {
    if (cargando) return;
    setAviso("");

    if (password.trim() === "") {
      setAviso("Ingrese la contraseña.");

      return;
    }

    try {
      setCargando(true);

      const respuesta = await fetch(`${API_URL}/admin/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          password,
        }),
      });

      const datos = await leerRespuesta<{ mensaje?: string; token: string }>(respuesta);

      if (!respuesta.ok) {
        setAviso(datos.mensaje || "Contraseña incorrecta.");

        setAutenticado(false);

        return;
      }

      if (typeof datos.token !== "string" || !datos.token)
        throw new Error("El servidor no devolvió una sesión válida.");
      sessionStorage.setItem(CLAVE_SESION, "true");

      sessionStorage.setItem(CLAVE_TOKEN, datos.token);

      setToken(datos.token);

      setAutenticado(true);

      setPassword("");

      await cargarReservas(datos.token);
    } catch (error) {
      console.error(error);

      setAviso(mensajeError(error));

      setAutenticado(false);
    } finally {
      setCargando(false);
    }
  };

  const cerrarSesion = () => {
    sessionStorage.removeItem(CLAVE_SESION);

    sessionStorage.removeItem(CLAVE_TOKEN);

    setAutenticado(false);
    setToken("");
    setPassword("");
    setReservas([]);
    setAviso("");
    setBusqueda("");
  };

  const eliminarReserva = async (grupoId: string) => {
    if (eliminando) return;

    const confirmar = window.confirm(
      "¿Está seguro de eliminar toda esta reserva y todos sus horarios?",
    );

    if (!confirmar) {
      return;
    }

    try {
      setEliminando(grupoId);

      const respuesta = await fetch(`${API_URL}/reservas/grupo/${encodeURIComponent(grupoId)}`, {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const datos = await leerRespuesta<{ mensaje?: string }>(respuesta);

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) cerrarSesion();

        setAviso(datos.mensaje || "No se pudo eliminar la reserva.");

        return;
      }

      setAviso("Reserva eliminada correctamente.");

      await cargarReservas(token);
    } catch (error) {
      console.error(error);

      setAviso(mensajeError(error));
    } finally {
      setEliminando(null);
    }
  };

  if (!autenticado) {
    return (
      <div className="inicio">
        <Marca />

        <div className="tarjeta">
          <span className="etiqueta">GESTIÓN DEL AULA</span>

          <h1>Administración AIP</h1>

          <h2>Acceso restringido</h2>

          <p>Ingrese la contraseña del administrador.</p>
          {aviso && (
            <div className="aviso" role="alert">
              {aviso}
            </div>
          )}

          <label htmlFor="password">Contraseña</label>

          <input
            id="password"
            autoComplete="current-password"
            maxLength={200}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingrese la contraseña"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                ingresar();
              }
            }}
          />

          <button onClick={ingresar} disabled={cargando}>
            {cargando ? "VERIFICANDO..." : "INGRESAR"}
          </button>
          <Link className="boton-administracion" to="/">
            ← Volver a reservas docentes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="horario-container admin-container">
      <header className="barra-superior">
        <Marca />
        <span className="sesion-docente">Administración</span>
      </header>

      <div className="horario-header">
        <div>
          <span className="etiqueta">GESTIÓN DEL AULA</span>
          <h1>Administración AIP</h1>

          <h2>Reservas registradas</h2>
        </div>

        <button className="boton-cerrar-sesion" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
      {aviso && (
        <div className="aviso" role="status">
          <span>{aviso}</span>
          <button aria-label="Cerrar mensaje" onClick={() => setAviso("")}>
            ×
          </button>
        </div>
      )}
      <div className="admin-resumen">
        <div>
          <strong>{reservas.length}</strong>
          <span>Reservas registradas</span>
        </div>
        <div>
          <strong>{new Set(reservas.map((r) => r.profesor)).size}</strong>
          <span>Docentes con reservas</span>
        </div>
        <div>
          <strong>{new Set(reservas.map((r) => r.fecha_programada)).size}</strong>
          <span>Días con reservas</span>
        </div>
      </div>
      <div className="tabla-admin">
        <div className="admin-herramientas">
          <div>
            <h2>Agenda de reservas</h2>
            <p>
              {filtradas.length} de {reservas.length} reservas · Desliza la tabla para ver todas las
              columnas.
            </p>
          </div>
          <div className="admin-busqueda">
            <label htmlFor="buscar-reservas">Buscar reservas</label>
            <input
              id="buscar-reservas"
              type="search"
              placeholder="Docente, área, grado o fecha…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button disabled={cargando} onClick={() => void cargarReservas(token)}>
            Actualizar
          </button>
        </div>

        {cargando ? (
          <p className="estado-vacio" role="status">
            Cargando reservas...
          </p>
        ) : errorCarga && reservas.length === 0 ? (
          <div className="estado-vacio">
            <h3>No se pudo cargar la agenda</h3>
            <p>Comprueba la conexión y pulsa Actualizar para intentarlo nuevamente.</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="estado-vacio">
            <h3>{busqueda ? "No encontramos coincidencias" : "La agenda está libre"}</h3>
            <p>
              {busqueda
                ? "Prueba con otro nombre, área o fecha."
                : "Las reservas de los docentes aparecerán aquí."}
            </p>
          </div>
        ) : (
          <div className="tabla-scroll" tabIndex={0} role="region" aria-label="Tabla de reservas">
            <table>
              <thead>
                <tr>
                  <th>Profesor</th>

                  <th>Área</th>

                  <th>Grado</th>

                  <th>Sección</th>

                  <th>Día</th>

                  <th>Fecha programada</th>

                  <th>Horarios</th>

                  <th>Fecha de reserva</th>

                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((reserva) => (
                  <tr key={reserva.grupo_id}>
                    <td>{reserva.profesor}</td>

                    <td>{reserva.area}</td>

                    <td>{reserva.grado}</td>

                    <td>{reserva.seccion}</td>

                    <td>{reserva.dia}</td>

                    <td>{mostrarFecha(reserva.fecha_programada)}</td>

                    <td>
                      {reserva.horarios.map((horario, indice) => (
                        <div key={indice}>{horario}</div>
                      ))}
                    </td>

                    <td>{mostrarFechaReserva(reserva.fecha_reserva)}</td>

                    <td>
                      <button
                        className="boton-eliminar"
                        disabled={!!eliminando}
                        aria-label={`Eliminar reserva de ${reserva.profesor} del ${reserva.fecha_programada}`}
                        onClick={() => eliminarReserva(reserva.grupo_id)}
                      >
                        {eliminando === reserva.grupo_id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
