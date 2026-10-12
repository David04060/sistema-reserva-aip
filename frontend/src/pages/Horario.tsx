import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config/api";
import Marca from "../components/Marca";
import { leerRespuesta, mensajeError } from "../lib/http";
import { hoyEnLima } from "../lib/fechas";

import {
  bloques,
  nombresMeses,
  nombresDias,
  agruparBloques,
  type Bloque,
  type Reserva,
  type Seleccion,
} from "../domain/horario";

function Horario() {
  const navigate = useNavigate();
  const profesor = sessionStorage.getItem("profesor")?.trim() || "";

  const [hoy, setHoy] = useState(hoyEnLima);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);
  const [errorReservas, setErrorReservas] = useState("");
  const [aviso, setAviso] = useState("");

  const cargarReservasPublicas = async (signal?: AbortSignal) => {
    setCargandoReservas(true);
    setErrorReservas("");
    try {
      const respuesta = await fetch(`${API_URL}/reservas/publicas`, { signal });
      if (!respuesta.ok) throw new Error("No se pudieron obtener las reservas.");
      const datos = await leerRespuesta<Reserva[]>(respuesta);
      if (!Array.isArray(datos)) throw new Error("Respuesta de reservas inválida.");
      if (!signal?.aborted) setReservas(datos);
    } catch {
      if (signal?.aborted) return;
      setErrorReservas("No se pudieron cargar los horarios. Intente nuevamente.");
    } finally {
      if (!signal?.aborted) setCargandoReservas(false);
    }
  };

  const [mesActual, setMesActual] = useState(hoy.getMonth());

  const [añoActual, setAñoActual] = useState(hoy.getFullYear());

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);

  const [reservas, setReservas] = useState<Reserva[]>([]);

  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [area, setArea] = useState("");
  const [grado, setGrado] = useState("");
  const [seccion, setSeccion] = useState("");

  const [cargandoReservas, setCargandoReservas] = useState(true);

  /*
    Cargar reservas públicas.
  */
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return cargarReservasPublicas(controller.signal);
    });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const temporizador = window.setInterval(() => {
      const actual = hoyEnLima();
      setHoy((anterior) => (anterior.getTime() === actual.getTime() ? anterior : actual));
    }, 60000);
    return () => window.clearInterval(temporizador);
  }, []);

  const salir = () => {
    sessionStorage.removeItem("profesor");
    navigate("/", { replace: true });
  };
  /*
    Obtener cantidad de días del mes.
  */
  const obtenerDiasDelMes = () => {
    return new Date(añoActual, mesActual + 1, 0).getDate();
  };

  /*
    Obtener el día de la semana del primer día.
  */
  const obtenerPrimerDia = () => {
    return new Date(añoActual, mesActual, 1).getDay();
  };

  /*
    Convertir una fecha a YYYY-MM-DD.
  */
  const formatearFecha = (año: number, mes: number, dia: number) => {
    return `${año}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  };

  /*
    Verificar si una fecha es anterior a hoy.
  */
  const fechaPasada = (año: number, mes: number, dia: number) => {
    const fecha = new Date(año, mes, dia);

    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    return fecha < fechaHoy;
  };

  /*
    No permitir domingos ni sábados.
  */
  const finDeSemana = (año: number, mes: number, dia: number) => {
    const fecha = new Date(año, mes, dia);

    const diaSemana = fecha.getDay();

    return diaSemana === 0 || diaSemana === 6;
  };

  /*
    Cambiar al mes anterior.
  */
  const mesAnterior = () => {
    if (añoActual === hoy.getFullYear() && mesActual === hoy.getMonth()) {
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
  const seleccionarFecha = (año: number, mes: number, dia: number) => {
    if (fechaPasada(año, mes, dia) || finDeSemana(año, mes, dia)) {
      return;
    }

    const fecha = formatearFecha(año, mes, dia);

    setFechaSeleccionada(fecha);
    setAviso("");
    setSeleccionados([]);
    setMostrarFormulario(false);
    void cargarReservasPublicas();
  };

  /*
    Buscar reserva para un bloque.
  */
  const obtenerReservaDelBloque = (bloque: Bloque) => {
    if (!fechaSeleccionada) {
      return undefined;
    }

    return reservas.find(
      (reserva) =>
        reserva.fecha_programada === fechaSeleccionada &&
        reserva.hora_inicio < bloque.fin &&
        reserva.hora_fin > bloque.inicio,
    );
  };

  /*
    Seleccionar o quitar un bloque.
  */
  const seleccionarBloque = (bloque: Bloque) => {
    if (bloque.receso || cargandoReservas || errorReservas || obtenerReservaDelBloque(bloque)) {
      return;
    }

    const yaSeleccionado = seleccionados.some((seleccion) => seleccion.bloqueId === bloque.id);

    if (yaSeleccionado) {
      setSeleccionados(seleccionados.filter((seleccion) => seleccion.bloqueId !== bloque.id));

      return;
    }

    setSeleccionados([
      ...seleccionados,
      {
        bloqueId: bloque.id,
      },
    ]);
  };

  /*
    Agrupar bloques consecutivos.
  */
  const obtenerReservasAgrupadas = () => agruparBloques(seleccionados);

  /*
    Continuar hacia el formulario.
  */
  const continuarReserva = () => {
    if (cargandoReservas || errorReservas) return;
    if (!fechaSeleccionada) {
      return;
    }

    if (
      fechaSeleccionada <
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    ) {
      setAviso("La fecha seleccionada ya pasó. Elige otra fecha.");
      setFechaSeleccionada(null);
      setMostrarFormulario(false);
      setSeleccionados([]);
      return;
    }

    if (seleccionados.length === 0) {
      setAviso("Seleccione al menos un horario.");

      return;
    }

    setMostrarFormulario(true);
  };

  /*
    Confirmar reserva.
  */
  const confirmarFormulario = async () => {
    if (enviando.current) return;
    if (!profesor || profesor.length > 100) {
      setAviso("Ingrese un nombre de profesor válido (máximo 100 caracteres).");
      navigate("/", { replace: true });
      return;
    }
    if (area.trim() === "" || grado.trim() === "" || seccion.trim() === "") {
      setAviso("Complete Área, Grado y Sección.");

      return;
    }

    if (!fechaSeleccionada) {
      return;
    }

    const reservasAgrupadas = obtenerReservasAgrupadas();
    const actual = hoyEnLima();
    if (new Date(`${fechaSeleccionada}T12:00:00`) < actual) {
      setAviso("La fecha seleccionada ya pasó. Elige otra fecha.");
      setMostrarFormulario(false);
      setFechaSeleccionada(null);
      setSeleccionados([]);
      return;
    }

    if (reservasAgrupadas.length === 0 || cargandoReservas || errorReservas) return;
    enviando.current = true;
    setGuardando(true);

    try {
      const respuesta = await fetch(`${API_URL}/reservas/multiple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profesor,
          area: area.trim(),
          grado: grado.trim(),
          seccion: seccion.trim(),
          fechaProgramada: fechaSeleccionada,
          reservas: reservasAgrupadas.map((reserva) => ({
            horaInicio: reserva.horaInicio,
            horaFin: reserva.horaFin,
          })),
        }),
      });

      const datos = await leerRespuesta<{ mensaje?: string }>(respuesta);

      if (!respuesta.ok) {
        setAviso(datos.mensaje || "No se pudo guardar la reserva.");
        if (respuesta.status === 409) {
          setSeleccionados([]);
          setMostrarFormulario(false);
          await cargarReservasPublicas();
        }
        return;
      }

      setAviso("Reserva realizada correctamente.");

      setSeleccionados([]);
      setMostrarFormulario(false);

      setArea("");
      setGrado("");
      setSeccion("");

      /*
        Volver a cargar las reservas.
      */
      await cargarReservasPublicas();
    } catch (error) {
      console.error(error);

      setAviso(mensajeError(error));
    } finally {
      enviando.current = false;
      setGuardando(false);
    }
  };

  /*
    Generar las celdas del calendario.
  */
  const diasDelMes = obtenerDiasDelMes();

  const primerDia = obtenerPrimerDia();

  const calendario = [];

  for (let i = 0; i < primerDia; i++) {
    calendario.push(<div key={`vacio-${i}`} className="dia-calendario vacio" />);
  }

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const fecha = formatearFecha(añoActual, mesActual, dia);

    const fechaEsPasada = fechaPasada(añoActual, mesActual, dia);

    const esFinDeSemana = finDeSemana(añoActual, mesActual, dia);

    const seleccionada = fechaSeleccionada === fecha;

    calendario.push(
      <button
        key={fecha}
        aria-label={`${dia} de ${nombresMeses[mesActual]} de ${añoActual}`}
        aria-pressed={seleccionada}
        className={`
          dia-calendario
          ${fechaEsPasada ? "pasado" : ""}
          ${esFinDeSemana ? "fin-semana" : ""}
          ${seleccionada ? "seleccionado" : ""}
        `}
        disabled={fechaEsPasada || esFinDeSemana}
        onClick={() => seleccionarFecha(añoActual, mesActual, dia)}
      >
        <span>{dia}</span>
      </button>,
    );
  }

  const fechaMostrar = fechaSeleccionada ? new Date(`${fechaSeleccionada}T12:00:00`) : null;

  const diaNombre = fechaMostrar ? nombresDias[fechaMostrar.getDay()] : "";

  return (
    <div className="horario-container">
      <header className="barra-superior">
        <Marca />
        <span className="sesion-docente">Sesión docente</span>
      </header>
      <div className="horario-header">
        <span className="etiqueta">PLANIFICA TU CLASE</span>
        <h1>Reserva el aula</h1>

        <h2>Elige el día y los bloques que necesitas para tu clase.</h2>

        <p>
          Profesor: <strong>{profesor}</strong>
        </p>
      </div>
      <button className="boton-salir" disabled={guardando} onClick={salir}>
        Cerrar sesión
      </button>
      <ol className="pasos-reserva" aria-label="Progreso de la reserva">
        {["Fecha", "Horario", "Confirmación"].map((paso, indice) => {
          const actual = mostrarFormulario ? 2 : fechaSeleccionada ? 1 : 0;
          return (
            <li
              key={paso}
              className={indice === actual ? "activo" : indice < actual ? "completo" : ""}
              aria-current={indice === actual ? "step" : undefined}
            >
              <span>{indice < actual ? "✓" : indice + 1}</span>
              {paso}
            </li>
          );
        })}
      </ol>
      {aviso && (
        <div className="aviso" role="status">
          <span>{aviso}</span>
          <button aria-label="Cerrar mensaje" onClick={() => setAviso("")}>
            ×
          </button>
        </div>
      )}
      {!fechaSeleccionada && !mostrarFormulario && (
        <div className="calendario-container">
          <div className="calendario-header">
            <button
              className="boton-mes"
              aria-label="Mes anterior"
              onClick={mesAnterior}
              disabled={añoActual === hoy.getFullYear() && mesActual === hoy.getMonth()}
            >
              ◀
            </button>

            <h2>
              {nombresMeses[mesActual]} {añoActual}
            </h2>

            <button className="boton-mes" aria-label="Mes siguiente" onClick={mesSiguiente}>
              ▶
            </button>
          </div>

          <p className="instruccion">Seleccione la fecha en la que desea realizar la reserva.</p>

          <div className="calendario">
            {["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"].map((dia) => (
              <div key={dia} className="nombre-dia">
                {dia}
              </div>
            ))}

            {calendario}
          </div>

          <p className="nota-calendario">
            Los días anteriores y los fines de semana no están disponibles.
          </p>
        </div>
      )}

      {fechaSeleccionada && !mostrarFormulario && (
        <div className="horario-dia">
          <div className="fecha-seleccionada">
            <button
              className="boton-volver-calendario"
              onClick={() => {
                setFechaSeleccionada(null);
                setSeleccionados([]);
              }}
            >
              ← Volver al calendario
            </button>

            <h2>
              {diaNombre} {fechaSeleccionada.split("-").reverse().join("/")}
            </h2>

            <p>Seleccione uno o más bloques disponibles.</p>
            <div className="leyenda">
              <span>
                <i className="punto-disponible" />
                Disponible
              </span>
              <span>
                <i className="punto-seleccionado" />
                Seleccionado
              </span>
              <span>
                <i className="punto-reservado" />
                Reservado
              </span>
            </div>
          </div>

          {cargandoReservas ? (
            <p>Cargando horarios...</p>
          ) : errorReservas ? (
            <div role="alert">
              <p>{errorReservas}</p>
              <button onClick={() => void cargarReservasPublicas()}>Reintentar</button>
            </div>
          ) : (
            <div className="tabla-horario">
              <div className="fila">
                <div className="celda encabezado hora">HORA</div>

                <div className="celda encabezado">AIP</div>
              </div>

              {bloques.map((bloque) => {
                const reserva = obtenerReservaDelBloque(bloque);

                const seleccionado = seleccionados.some(
                  (seleccion) => seleccion.bloqueId === bloque.id,
                );

                return (
                  <div className="fila" key={bloque.id}>
                    <div className="celda hora">
                      {bloque.inicio} - {bloque.fin}
                    </div>

                    <button
                      type="button"
                      disabled={!!bloque.receso || !!reserva}
                      aria-pressed={seleccionado}
                      aria-label={`${bloque.inicio} a ${bloque.fin}: ${bloque.receso ? "receso" : reserva ? `reservado por ${reserva.profesor}` : seleccionado ? "seleccionado" : "disponible"}`}
                      className={`
                            celda bloque
                            ${bloque.receso ? "receso" : ""}
                            ${seleccionado ? "seleccionado" : ""}
                            ${reserva ? "reservado" : ""}
                          `}
                      onClick={() => seleccionarBloque(bloque)}
                    >
                      {bloque.receso ? (
                        <strong>RECESO</strong>
                      ) : reserva ? (
                        <>
                          <strong>RESERVADO</strong>
                          <small>{reserva.profesor}</small>
                        </>
                      ) : seleccionado ? (
                        "SELECCIONADO"
                      ) : (
                        "DISPONIBLE"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {seleccionados.length > 0 && (
            <div className="seleccion-info">
              <p>
                Bloques seleccionados: <strong>{seleccionados.length}</strong>
              </p>

              <button className="boton-continuar" onClick={continuarReserva}>
                Completar datos →
              </button>
            </div>
          )}
        </div>
      )}

      {mostrarFormulario && (
        <form
          className="formulario-reserva"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmarFormulario();
          }}
        >
          <button
            type="button"
            className="boton-volver-calendario"
            disabled={guardando}
            onClick={() => setMostrarFormulario(false)}
          >
            ← Volver al horario
          </button>

          <h2>Confirma los datos de tu clase</h2>
          <p className="formulario-intro">
            Revisa los horarios y completa los campos para finalizar.
          </p>

          <div className="resumen-final">
            <p>
              <strong>Profesor:</strong> {profesor}
            </p>

            <p>
              <strong>Fecha:</strong> {diaNombre}{" "}
              {fechaSeleccionada?.split("-").reverse().join("/")}
            </p>

            <p>
              <strong>Horarios:</strong>
            </p>

            {obtenerReservasAgrupadas().map((reserva, index) => (
              <p key={index}>
                {reserva.horaInicio} - {reserva.horaFin}
              </p>
            ))}
          </div>

          <label htmlFor="area">Área</label>

          <input
            id="area"
            disabled={guardando}
            required
            maxLength={100}
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ejemplo: Comunicación"
          />

          <label htmlFor="grado">Grado</label>

          <input
            id="grado"
            disabled={guardando}
            required
            maxLength={30}
            type="text"
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            placeholder="Ejemplo: 5°"
          />

          <label htmlFor="seccion">Sección</label>

          <input
            id="seccion"
            disabled={guardando}
            required
            maxLength={20}
            type="text"
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            placeholder="Ejemplo: A"
          />

          <div className="botones-formulario">
            <button
              type="button"
              className="boton-cancelar"
              disabled={guardando}
              onClick={() => {
                setMostrarFormulario(false);
              }}
            >
              Volver
            </button>

            <button type="submit" className="boton-confirmar" disabled={guardando}>
              {guardando ? "Guardando reserva…" : "Confirmar reserva"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Horario;
