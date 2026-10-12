import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Marca from "../components/Marca";

export default function Inicio() {
  const [profesor, setProfesor] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const continuar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profesor.trim() || profesor.trim().length > 100) {
      setError("Ingrese su nombre completo para continuar.");
      return;
    }
    sessionStorage.setItem("profesor", profesor.trim());
    navigate("/horario");
  };
  return (
    <div className="pagina-inicio">
      <header className="barra-superior">
        <Marca />
        <Link className="enlace-admin" to="/admin">
          Administración <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="inicio-layout">
        <section className="inicio-presentacion">
          <span className="etiqueta">ESPACIOS PARA APRENDER</span>
          <h1>
            Tu próxima clase,
            <br />
            <span>un paso más cerca.</span>
          </h1>
          <p>
            Reserva el Aula de Innovación Pedagógica y prepara un espacio para descubrir, crear y
            aprender.
          </p>
          <div className="ilustracion-aula" aria-hidden="true">
            <div className="ilustracion-barra">
              <span />
              <span />
              <span />
              <small>AULA DE INNOVACIÓN</small>
            </div>
            <div className="ilustracion-contenido">
              <div className="ilustracion-monitor">
                <svg viewBox="0 0 180 110" fill="none">
                  <rect
                    x="1"
                    y="1"
                    width="178"
                    height="108"
                    rx="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="m48 55 20-16v32L48 55Zm84 0-20-16v32l20-16ZM99 30 81 80"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
                <span />
              </div>
              <div className="ilustracion-panel">
                <span>UNA CLASE, MUCHAS POSIBILIDADES</span>
                <strong>
                  Ideas que
                  <br />
                  cobran vida.
                </strong>
                <div className="ilustracion-lineas">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <div className="ilustracion-pie">
              <span>● Tecnología al servicio del aprendizaje</span>
              <span>↗</span>
            </div>
          </div>
          <div className="inicio-datos">
            <div>
              <strong>Lunes a viernes</strong>
              <span>Días de atención</span>
            </div>
            <div>
              <strong>13:00 – 18:00</strong>
              <span>Horario del aula</span>
            </div>
            <div>
              <strong>40 minutos</strong>
              <span>Por bloque de clase</span>
            </div>
          </div>
        </section>
        <section className="tarjeta tarjeta-ingreso" aria-labelledby="titulo-ingreso">
          <span className="etiqueta">RESERVA DOCENTE</span>
          <h2 id="titulo-ingreso">Empecemos con tu nombre</h2>
          <p>Así identificaremos tu reserva en el horario del aula.</p>
          <form onSubmit={continuar} noValidate>
            <label htmlFor="profesor">Nombre completo</label>
            <input
              id="profesor"
              maxLength={100}
              autoComplete="name"
              value={profesor}
              aria-invalid={!!error}
              aria-describedby={error ? "error-profesor" : "ayuda-profesor"}
              onChange={(e) => {
                setProfesor(e.target.value);
                setError("");
              }}
              placeholder="Ej. María Pérez García"
            />
            {error ? (
              <p className="error-campo" id="error-profesor" role="alert">
                {error}
              </p>
            ) : (
              <p className="ayuda-campo" id="ayuda-profesor">
                Escribe el nombre que aparecerá en tu reserva.
              </p>
            )}
            <button type="submit">
              Elegir fecha y horario <span aria-hidden="true">→</span>
            </button>
          </form>
          <ol className="inicio-pasos">
            <li>
              <span>1</span>
              <div>
                <strong>Elige una fecha</strong>
                <small>Consulta los días disponibles.</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Selecciona tus bloques</strong>
                <small>Reserva uno o varios horarios.</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Confirma tu reserva</strong>
                <small>Completa los datos de tu clase.</small>
              </div>
            </li>
          </ol>
          <div className="nota-ingreso">Tu nombre se conserva durante esta sesión.</div>
        </section>
      </main>
      <footer className="pie-pagina">
        AIP · Sistema de reservas <span>Más tiempo para enseñar. Menos tiempo para coordinar.</span>
      </footer>
    </div>
  );
}
