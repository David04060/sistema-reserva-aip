import { useEffect, useState } from "react";

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

const CLAVE_SESION =
  "admin_authenticated";

const CLAVE_TOKEN =
  "admin_token";


function Admin() {

  const [password, setPassword] =
    useState("");

  const [autenticado, setAutenticado] =
    useState(false);

  const [token, setToken] =
    useState("");

  const [reservas, setReservas] =
    useState<ReservaAgrupada[]>([]);

  const [cargando, setCargando] =
    useState(false);


  /* =====================================================
     AGRUPAR RESERVAS
     ===================================================== */

  const agruparReservas = (
    datos: Reserva[]
  ): ReservaAgrupada[] => {

    const grupos =
      new Map<
        string,
        ReservaAgrupada
      >();

    datos.forEach((reserva) => {

      if (
        !grupos.has(
          reserva.grupo_id
        )
      ) {

        grupos.set(
          reserva.grupo_id,
          {
            grupo_id:
              reserva.grupo_id,

            profesor:
              reserva.profesor,

            area:
              reserva.area,

            grado:
              reserva.grado,

            seccion:
              reserva.seccion,

            dia:
              reserva.dia,

            fecha_programada:
              reserva.fecha_programada,

            fecha_reserva:
              reserva.fecha_reserva,

            horarios: []
          }
        );
      }

      grupos
        .get(reserva.grupo_id)!
        .horarios
        .push(
          `${reserva.hora_inicio} - ${reserva.hora_fin}`
        );
    });

    return Array.from(
      grupos.values()
    );
  };


  /* =====================================================
     CARGAR RESERVAS
     ===================================================== */

  const cargarReservas = async (
    tokenAdministrador: string
  ) => {

    try {

      setCargando(true);

      const respuesta =
        await fetch(
          "http://localhost:3000/reservas/admin",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${tokenAdministrador}`
            }
          }
        );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {

        sessionStorage.removeItem(
          CLAVE_SESION
        );

        sessionStorage.removeItem(
          CLAVE_TOKEN
        );

        setAutenticado(false);
        setToken("");

        alert(
          datos.mensaje ||
            "La sesión de administrador ya no es válida."
        );

        return false;
      }

      setReservas(
        agruparReservas(datos)
      );

      return true;

    } catch (error) {

      console.error(error);

      alert(
        "No se pudo conectar con el servidor."
      );

      return false;

    } finally {

      setCargando(false);
    }
  };


  /* =====================================================
     RECUPERAR SESIÓN
     ===================================================== */

  useEffect(() => {

    const sesionGuardada =
      sessionStorage.getItem(
        CLAVE_SESION
      );

    const tokenGuardado =
      sessionStorage.getItem(
        CLAVE_TOKEN
      );

    if (
      sesionGuardada === "true" &&
      tokenGuardado
    ) {

      setToken(
        tokenGuardado
      );

      setAutenticado(true);

      cargarReservas(
        tokenGuardado
      );
    }

  }, []);


  /* =====================================================
     INGRESAR
     ===================================================== */

  const ingresar = async () => {

    if (
      password.trim() === ""
    ) {

      alert(
        "Ingrese la contraseña."
      );

      return;
    }

    try {

      setCargando(true);

      const respuesta =
        await fetch(
          "http://localhost:3000/admin/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              password
            })
          }
        );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {

        alert(
          datos.mensaje ||
            "Contraseña incorrecta."
        );

        setAutenticado(false);

        return;
      }

      sessionStorage.setItem(
        CLAVE_SESION,
        "true"
      );

      sessionStorage.setItem(
        CLAVE_TOKEN,
        datos.token
      );

      setToken(
        datos.token
      );

      setAutenticado(true);

      setPassword("");

      await cargarReservas(
        datos.token
      );

    } catch (error) {

      console.error(error);

      alert(
        "No se pudo conectar con el servidor."
      );

      setAutenticado(false);

    } finally {

      setCargando(false);
    }
  };


  /* =====================================================
     CERRAR SESIÓN
     ===================================================== */

  const cerrarSesion = () => {

    sessionStorage.removeItem(
      CLAVE_SESION
    );

    sessionStorage.removeItem(
      CLAVE_TOKEN
    );

    setAutenticado(false);
    setToken("");
    setPassword("");
    setReservas([]);
  };


  /* =====================================================
     ELIMINAR RESERVA COMPLETA
     ===================================================== */

  const eliminarReserva = async (
    grupoId: string
  ) => {

    const confirmar =
      window.confirm(
        "¿Está seguro de eliminar toda esta reserva y todos sus horarios?"
      );

    if (!confirmar) {
      return;
    }

    try {

      const respuesta =
        await fetch(
          `http://localhost:3000/reservas/grupo/${grupoId}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {

        alert(
          datos.mensaje ||
            "No se pudo eliminar la reserva."
        );

        return;
      }

      alert(
        "Reserva eliminada correctamente."
      );

      await cargarReservas(
        token
      );

    } catch (error) {

      console.error(error);

      alert(
        "No se pudo conectar con el servidor."
      );
    }
  };


  /* =====================================================
     PANTALLA DE LOGIN
     ===================================================== */

  if (!autenticado) {

    return (
      <div className="inicio">

        <div className="tarjeta">

          <h1>
            Administración AIP
          </h1>

          <h2>
            Acceso restringido
          </h2>

          <p>
            Ingrese la contraseña del
            administrador.
          </p>

          <label htmlFor="password">
            Contraseña
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="Ingrese la contraseña"
            onKeyDown={(e) => {

              if (
                e.key === "Enter"
              ) {
                ingresar();
              }

            }}
          />

          <button
            onClick={ingresar}
            disabled={cargando}
          >
            {cargando
              ? "VERIFICANDO..."
              : "INGRESAR"}
          </button>

        </div>

      </div>
    );
  }


  /* =====================================================
     PANEL ADMINISTRATIVO
     ===================================================== */

  return (
    <div className="horario-container">

      <div className="horario-header">

        <h1>
          Administración AIP
        </h1>

        <h2>
          Reservas registradas
        </h2>

        <button
          className="boton-cerrar-sesion"
          onClick={
            cerrarSesion
          }
        >
          CERRAR SESIÓN
        </button>

      </div>


      <div className="tabla-admin">

        {cargando ? (

          <p>
            Cargando reservas...
          </p>

        ) : reservas.length === 0 ? (

          <p>
            No existen reservas registradas.
          </p>

        ) : (

          <table>

            <thead>

              <tr>

                <th>
                  Profesor
                </th>

                <th>
                  Área
                </th>

                <th>
                  Grado
                </th>

                <th>
                  Sección
                </th>

                <th>
                  Día
                </th>

                <th>
                  Fecha programada
                </th>

                <th>
                  Horarios
                </th>

                <th>
                  Fecha de reserva
                </th>

                <th>
                  Acción
                </th>

              </tr>

            </thead>


            <tbody>

              {reservas.map(
                (reserva) => (

                  <tr
                    key={
                      reserva.grupo_id
                    }
                  >

                    <td>
                      {
                        reserva.profesor
                      }
                    </td>

                    <td>
                      {
                        reserva.area
                      }
                    </td>

                    <td>
                      {
                        reserva.grado
                      }
                    </td>

                    <td>
                      {
                        reserva.seccion
                      }
                    </td>

                    <td>
                      {
                        reserva.dia
                      }
                    </td>

                    <td>
                      {
                        reserva.fecha_programada
                      }
                    </td>

                    <td>

                      {reserva.horarios.map(
                        (
                          horario,
                          indice
                        ) => (

                          <div
                            key={indice}
                          >
                            {horario}
                          </div>

                        )
                      )}

                    </td>

                    <td>
                      {
                        reserva.fecha_reserva
                      }
                    </td>

                    <td>

                      <button
                        className="boton-eliminar"
                        onClick={() =>
                          eliminarReserva(
                            reserva.grupo_id
                          )
                        }
                      >
                        ELIMINAR
                      </button>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
}

export default Admin;