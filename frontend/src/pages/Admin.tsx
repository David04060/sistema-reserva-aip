import { useEffect, useState } from "react";

interface Reserva {
  id: number;
  profesor: string;
  area: string;
  grado: string;
  seccion: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  fecha_reserva: string;
}

function Admin() {
  const [password, setPassword] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);

  const cargarReservas = async () => {
    try {
      const respuesta = await fetch(
        "http://localhost:3000/reservas"
      );

      const datos = await respuesta.json();

      setReservas(datos);
    } catch (error) {
      console.error(error);

      alert("No se pudieron cargar las reservas.");
    }
  };

  useEffect(() => {
    if (autenticado) {
      cargarReservas();
    }
  }, [autenticado]);

  const ingresar = () => {
    if (password.trim() === "") {
      alert("Ingrese la contraseña.");
      return;
    }

    setAutenticado(true);
  };

  const eliminarReserva = async (id: number) => {
    const confirmar = window.confirm(
      "¿Está seguro de eliminar esta reserva?"
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3000/reservas/${id}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-password": password
          }
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje);
        return;
      }

      alert("Reserva eliminada correctamente.");

      cargarReservas();

    } catch (error) {
      console.error(error);

      alert(
        "No se pudo conectar con el servidor."
      );
    }
  };

  if (!autenticado) {
    return (
      <div className="inicio">
        <div className="tarjeta">
          <h1>Administración AIP</h1>

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
              setPassword(e.target.value)
            }
            placeholder="Ingrese la contraseña"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                ingresar();
              }
            }}
          />

          <button onClick={ingresar}>
            INGRESAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="horario-container">

      <div className="horario-header">

        <h1>
          Administración AIP
        </h1>

        <h2>
          Reservas registradas
        </h2>

      </div>

      <div className="tabla-admin">

        {reservas.length === 0 ? (

          <p>
            No existen reservas registradas.
          </p>

        ) : (

          <table>

            <thead>
              <tr>
                <th>Profesor</th>
                <th>Área</th>
                <th>Grado</th>
                <th>Sección</th>
                <th>Día</th>
                <th>Horario</th>
                <th>Fecha</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>

              {reservas.map((reserva) => (

                <tr key={reserva.id}>

                  <td>
                    {reserva.profesor}
                  </td>

                  <td>
                    {reserva.area}
                  </td>

                  <td>
                    {reserva.grado}
                  </td>

                  <td>
                    {reserva.seccion}
                  </td>

                  <td>
                    {reserva.dia}
                  </td>

                  <td>
                    {reserva.hora_inicio} -
                    {" "}
                    {reserva.hora_fin}
                  </td>

                  <td>
                    {reserva.fecha_reserva}
                  </td>

                  <td>
                    <button
                      className="boton-eliminar"
                      onClick={() =>
                        eliminarReserva(
                          reserva.id
                        )
                      }
                    >
                      ELIMINAR
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
}

export default Admin;