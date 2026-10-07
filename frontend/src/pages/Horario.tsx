import { useEffect, useState } from "react";

interface Bloque {
  id: number;
  inicio: string;
  fin: string;
  receso?: boolean;
}

interface Reserva {
  dia: string;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string;
  profesor: string;
}

interface Seleccion {
  bloqueId: number;
}

interface ReservaAgrupada {
  horaInicio: string;
  horaFin: string;
}

const bloques: Bloque[] = [
  {
    id: 1,
    inicio: "13:00",
    fin: "13:40"
  },
  {
    id: 2,
    inicio: "13:40",
    fin: "14:20"
  },
  {
    id: 3,
    inicio: "14:20",
    fin: "15:00"
  },
  {
    id: 4,
    inicio: "15:00",
    fin: "15:10",
    receso: true
  },
  {
    id: 5,
    inicio: "15:10",
    fin: "15:50"
  },
  {
    id: 6,
    inicio: "15:50",
    fin: "16:30"
  },
  {
    id: 7,
    inicio: "16:30",
    fin: "16:40",
    receso: true
  },
  {
    id: 8,
    inicio: "16:40",
    fin: "17:20"
  },
  {
    id: 9,
    inicio: "17:20",
    fin: "18:00"
  }
];

const nombresMeses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const nombresDias = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado"
];

function Horario() {
  const profesor =
    localStorage.getItem("profesor") || "";

  const hoy = new Date();

  const [mesActual, setMesActual] = useState(
    hoy.getMonth()
  );

  const [añoActual, setAñoActual] = useState(
    hoy.getFullYear()
  );

  const [fechaSeleccionada, setFechaSeleccionada] =
    useState<string | null>(null);

  const [reservas, setReservas] =
    useState<Reserva[]>([]);

  const [seleccionados, setSeleccionados] =
    useState<Seleccion[]>([]);

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [area, setArea] = useState("");
  const [grado, setGrado] = useState("");
  const [seccion, setSeccion] = useState("");

  const [cargandoReservas, setCargandoReservas] =
    useState(true);

  /*
    Cargar reservas públicas.
  */
  useEffect(() => {
    const cargarReservas = async () => {
      try {
        const respuesta = await fetch(
          "http://localhost:3000/reservas/publicas"
        );

        if (!respuesta.ok) {
          throw new Error(
            "No se pudieron obtener las reservas."
          );
        }

        const datos = await respuesta.json();

        setReservas(datos);
      } catch (error) {
        console.error(error);

        alert(
          "No se pudieron cargar las reservas."
        );
      } finally {
        setCargandoReservas(false);
      }
    };

    cargarReservas();
  }, []);

  /*
    Obtener cantidad de días del mes.
  */
  const obtenerDiasDelMes = () => {
    return new Date(
      añoActual,
      mesActual + 1,
      0
    ).getDate();
  };

  /*
    Obtener el día de la semana del primer día.
  */
  const obtenerPrimerDia = () => {
    return new Date(
      añoActual,
      mesActual,
      1
    ).getDay();
  };

  /*
    Convertir una fecha a YYYY-MM-DD.
  */
  const formatearFecha = (
    año: number,
    mes: number,
    dia: number
  ) => {
    return `${año}-${String(mes + 1).padStart(
      2,
      "0"
    )}-${String(dia).padStart(2, "0")}`;
  };

  /*
    Verificar si una fecha es anterior a hoy.
  */
  const fechaPasada = (
    año: number,
    mes: number,
    dia: number
  ) => {
    const fecha = new Date(
      año,
      mes,
      dia
    );

    const fechaHoy = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate()
    );

    return fecha < fechaHoy;
  };

  /*
    No permitir domingos ni sábados.
  */
  const finDeSemana = (
    año: number,
    mes: number,
    dia: number
  ) => {
    const fecha = new Date(
      año,
      mes,
      dia
    );

    const diaSemana = fecha.getDay();

    return (
      diaSemana === 0 ||
      diaSemana === 6
    );
  };

  /*
    Cambiar al mes anterior.
  */
  const mesAnterior = () => {
    if (
      añoActual === hoy.getFullYear() &&
      mesActual === hoy.getMonth()
    ) {
      return;
    }

    if (mesActual === 0) {
      setMesActual(11);
      setAñoActual(añoActual - 1);
    } else {
      setMesActual(mesActual - 1);
    }

    setFechaSeleccionada(null);
    setSeleccionados([]);
  };

  /*
    Cambiar al mes siguiente.
  */
  const mesSiguiente = () => {
    if (mesActual === 11) {
      setMesActual(0);
      setAñoActual(añoActual + 1);
    } else {
      setMesActual(mesActual + 1);
    }

    setFechaSeleccionada(null);
    setSeleccionados([]);
  };

  /*
    Seleccionar una fecha.
  */
  const seleccionarFecha = (
    año: number,
    mes: number,
    dia: number
  ) => {
    if (
      fechaPasada(año, mes, dia) ||
      finDeSemana(año, mes, dia)
    ) {
      return;
    }

    const fecha = formatearFecha(
      año,
      mes,
      dia
    );

    setFechaSeleccionada(fecha);
    setSeleccionados([]);
    setMostrarFormulario(false);
  };

  /*
    Buscar reserva para un bloque.
  */
  const obtenerReservaDelBloque = (
    bloque: Bloque
  ) => {
    if (!fechaSeleccionada) {
      return undefined;
    }

    return reservas.find(
      (reserva) =>
        reserva.fecha_programada ===
          fechaSeleccionada &&
        reserva.hora_inicio <
          bloque.fin &&
        reserva.hora_fin >
          bloque.inicio
    );
  };

  /*
    Seleccionar o quitar un bloque.
  */
  const seleccionarBloque = (
    bloque: Bloque
  ) => {
    if (
      bloque.receso ||
      obtenerReservaDelBloque(bloque)
    ) {
      return;
    }

    const yaSeleccionado =
      seleccionados.some(
        (seleccion) =>
          seleccion.bloqueId === bloque.id
      );

    if (yaSeleccionado) {
      setSeleccionados(
        seleccionados.filter(
          (seleccion) =>
            seleccion.bloqueId !==
            bloque.id
        )
      );

      return;
    }

    setSeleccionados([
      ...seleccionados,
      {
        bloqueId: bloque.id
      }
    ]);
  };

  /*
    Agrupar bloques consecutivos.
  */
  const obtenerReservasAgrupadas =
    (): ReservaAgrupada[] => {
      if (seleccionados.length === 0) {
        return [];
      }

      const ids = seleccionados
        .map(
          (seleccion) =>
            seleccion.bloqueId
        )
        .sort((a, b) => a - b);

      const grupos: ReservaAgrupada[] = [];

      let inicioGrupo =
        bloques.find(
          (bloque) =>
            bloque.id === ids[0]
        );

      let ultimoBloque =
        inicioGrupo;

      if (!inicioGrupo) {
        return [];
      }

      for (
        let i = 1;
        i < ids.length;
        i++
      ) {
        const bloqueActual =
          bloques.find(
            (bloque) =>
              bloque.id === ids[i]
          );

        if (!bloqueActual) {
          continue;
        }

        /*
          Si existe un receso entre ambos,
          se crea otro grupo.
        */
        if (
          bloqueActual.id !==
          (ultimoBloque?.id ?? 0) + 1
        ) {
          grupos.push({
            horaInicio:
              inicioGrupo.inicio,
            horaFin:
              ultimoBloque?.fin ||
              inicioGrupo.fin
          });

          inicioGrupo =
            bloqueActual;
        }

        ultimoBloque =
          bloqueActual;
      }

      grupos.push({
        horaInicio:
          inicioGrupo.inicio,
        horaFin:
          ultimoBloque?.fin ||
          inicioGrupo.fin
      });

      return grupos;
    };

  /*
    Continuar hacia el formulario.
  */
  const continuarReserva = () => {
    if (!fechaSeleccionada) {
      return;
    }

    if (seleccionados.length === 0) {
      alert(
        "Seleccione al menos un horario."
      );

      return;
    }

    setMostrarFormulario(true);
  };

  /*
    Confirmar reserva.
  */
  const confirmarFormulario = async () => {
    if (
      area.trim() === "" ||
      grado.trim() === "" ||
      seccion.trim() === ""
    ) {
      alert(
        "Complete Área, Grado y Sección."
      );

      return;
    }

    if (!fechaSeleccionada) {
      return;
    }

    const reservasAgrupadas =
      obtenerReservasAgrupadas();

    try {
      const respuesta = await fetch(
        "http://localhost:3000/reservas/multiple",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            profesor,
            area: area.trim(),
            grado: grado.trim(),
            seccion: seccion.trim(),
            fechaProgramada:
              fechaSeleccionada,
            reservas:
              reservasAgrupadas.map(
                (reserva) => ({
                  horaInicio:
                    reserva.horaInicio,
                  horaFin:
                    reserva.horaFin
                })
              )
          })
        }
      );

      const datos =
        await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje);
        return;
      }

      alert(
        "Reserva realizada correctamente."
      );

      setSeleccionados([]);
      setMostrarFormulario(false);

      setArea("");
      setGrado("");
      setSeccion("");

      /*
        Volver a cargar las reservas.
      */
      const nuevasReservas =
        await fetch(
          "http://localhost:3000/reservas/publicas"
        );

      const datosReservas =
        await nuevasReservas.json();

      setReservas(datosReservas);
    } catch (error) {
      console.error(error);

      alert(
        "No se pudo conectar con el servidor."
      );
    }
  };

  /*
    Generar las celdas del calendario.
  */
  const diasDelMes =
    obtenerDiasDelMes();

  const primerDia =
    obtenerPrimerDia();

  const calendario = [];

  for (
    let i = 0;
    i < primerDia;
    i++
  ) {
    calendario.push(
      <div
        key={`vacio-${i}`}
        className="dia-calendario vacio"
      />
    );
  }

  for (
    let dia = 1;
    dia <= diasDelMes;
    dia++
  ) {
    const fecha =
      formatearFecha(
        añoActual,
        mesActual,
        dia
      );

    const fechaEsPasada =
      fechaPasada(
        añoActual,
        mesActual,
        dia
      );

    const esFinDeSemana =
      finDeSemana(
        añoActual,
        mesActual,
        dia
      );

    const seleccionada =
      fechaSeleccionada === fecha;

    calendario.push(
      <button
        key={fecha}
        className={`
          dia-calendario
          ${fechaEsPasada ? "pasado" : ""}
          ${esFinDeSemana ? "fin-semana" : ""}
          ${seleccionada ? "seleccionado" : ""}
        `}
        disabled={
          fechaEsPasada ||
          esFinDeSemana
        }
        onClick={() =>
          seleccionarFecha(
            añoActual,
            mesActual,
            dia
          )
        }
      >
        <span>{dia}</span>
      </button>
    );
  }

  const fechaMostrar =
    fechaSeleccionada
      ? new Date(
          `${fechaSeleccionada}T12:00:00`
        )
      : null;

  const diaNombre =
    fechaMostrar
      ? nombresDias[
          fechaMostrar.getDay()
        ]
      : "";

  return (
    <div className="horario-container">
      <div className="horario-header">
        <h1>
          Sistema de Reservas AIP
        </h1>

        <h2>
          Aula de Innovación Pedagógica
        </h2>

        <p>
          Profesor:{" "}
          <strong>{profesor}</strong>
        </p>
      </div>

      {!fechaSeleccionada &&
        !mostrarFormulario && (
          <div className="calendario-container">
            <div className="calendario-header">
              <button
                className="boton-mes"
                onClick={mesAnterior}
                disabled={
                  añoActual ===
                    hoy.getFullYear() &&
                  mesActual ===
                    hoy.getMonth()
                }
              >
                ◀
              </button>

              <h2>
                {nombresMeses[
                  mesActual
                ]}{" "}
                {añoActual}
              </h2>

              <button
                className="boton-mes"
                onClick={
                  mesSiguiente
                }
              >
                ▶
              </button>
            </div>

            <p className="instruccion">
              Seleccione la fecha en la
              que desea realizar la reserva.
            </p>

            <div className="calendario">
              {[
                "DOM",
                "LUN",
                "MAR",
                "MIÉ",
                "JUE",
                "VIE",
                "SÁB"
              ].map((dia) => (
                <div
                  key={dia}
                  className="nombre-dia"
                >
                  {dia}
                </div>
              ))}

              {calendario}
            </div>

            <p className="nota-calendario">
              Los días anteriores y los
              fines de semana no están
              disponibles.
            </p>
          </div>
        )}

      {fechaSeleccionada &&
        !mostrarFormulario && (
          <div className="horario-dia">
            <div className="fecha-seleccionada">
              <button
                className="boton-volver-calendario"
                onClick={() => {
                  setFechaSeleccionada(
                    null
                  );
                  setSeleccionados([]);
                }}
              >
                ← Volver al calendario
              </button>

              <h2>
                {diaNombre}{" "}
                {fechaSeleccionada
                  .split("-")
                  .reverse()
                  .join("/")}
              </h2>

              <p>
                Seleccione uno o más
                bloques disponibles.
              </p>
            </div>

            {cargandoReservas ? (
              <p>
                Cargando horarios...
              </p>
            ) : (
              <div className="tabla-horario">
                <div className="fila">
                  <div className="celda encabezado hora">
                    HORA
                  </div>

                  <div className="celda encabezado">
                    AIP
                  </div>
                </div>

                {bloques.map(
                  (bloque) => {
                    const reserva =
                      obtenerReservaDelBloque(
                        bloque
                      );

                    const seleccionado =
                      seleccionados.some(
                        (
                          seleccion
                        ) =>
                          seleccion.bloqueId ===
                          bloque.id
                      );

                    return (
                      <div
                        className="fila"
                        key={
                          bloque.id
                        }
                      >
                        <div className="celda hora">
                          {bloque.inicio}{" "}
                          -{" "}
                          {bloque.fin}
                        </div>

                        <div
                          className={`
                            celda bloque
                            ${
                              bloque.receso
                                ? "receso"
                                : ""
                            }
                            ${
                              seleccionado
                                ? "seleccionado"
                                : ""
                            }
                            ${
                              reserva
                                ? "reservado"
                                : ""
                            }
                          `}
                          onClick={() =>
                            seleccionarBloque(
                              bloque
                            )
                          }
                        >
                          {bloque.receso ? (
                            <strong>
                              RECESO
                            </strong>
                          ) : reserva ? (
                            <>
                              <strong>
                                RESERVADO
                              </strong>
                              <br />
                              <small>
                                {
                                  reserva.profesor
                                }
                              </small>
                            </>
                          ) : seleccionado ? (
                            "SELECCIONADO"
                          ) : (
                            "DISPONIBLE"
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {seleccionados.length >
              0 && (
              <div className="seleccion-info">
                <p>
                  Bloques seleccionados:{" "}
                  <strong>
                    {
                      seleccionados.length
                    }
                  </strong>
                </p>

                <button
                  className="boton-continuar"
                  onClick={
                    continuarReserva
                  }
                >
                  CONTINUAR
                </button>
              </div>
            )}
          </div>
        )}

      {mostrarFormulario && (
        <div className="formulario-reserva">
          <button
            className="boton-volver-calendario"
            onClick={() =>
              setMostrarFormulario(false)
            }
          >
            ← Volver al horario
          </button>

          <h2>
            Datos de la reserva
          </h2>

          <div className="resumen-final">
            <p>
              <strong>
                Profesor:
              </strong>{" "}
              {profesor}
            </p>

            <p>
              <strong>
                Fecha:
              </strong>{" "}
              {diaNombre}{" "}
              {fechaSeleccionada
                ?.split("-")
                .reverse()
                .join("/")}
            </p>

            <p>
              <strong>
                Horarios:
              </strong>
            </p>

            {obtenerReservasAgrupadas().map(
              (reserva, index) => (
                <p key={index}>
                  {reserva.horaInicio} -{" "}
                  {reserva.horaFin}
                </p>
              )
            )}
          </div>

          <label htmlFor="area">
            Área
          </label>

          <input
            id="area"
            type="text"
            value={area}
            onChange={(e) =>
              setArea(e.target.value)
            }
            placeholder="Ejemplo: Comunicación"
          />

          <label htmlFor="grado">
            Grado
          </label>

          <input
            id="grado"
            type="text"
            value={grado}
            onChange={(e) =>
              setGrado(e.target.value)
            }
            placeholder="Ejemplo: 5°"
          />

          <label htmlFor="seccion">
            Sección
          </label>

          <input
            id="seccion"
            type="text"
            value={seccion}
            onChange={(e) =>
              setSeccion(e.target.value)
            }
            placeholder="Ejemplo: A"
          />

          <div className="botones-formulario">
            <button
              className="boton-cancelar"
              onClick={() => {
                setMostrarFormulario(
                  false
                );
              }}
            >
              CANCELAR
            </button>

            <button
              className="boton-confirmar"
              onClick={
                confirmarFormulario
              }
            >
              CONFIRMAR RESERVA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Horario;