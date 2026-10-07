import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Inicio() {
  const [profesor, setProfesor] = useState("");

  const navigate = useNavigate();

  const continuar = () => {
    if (profesor.trim() === "") {
      alert(
        "Por favor, ingrese su nombre completo."
      );

      return;
    }

    sessionStorage.setItem(
      "profesor",
      profesor.trim()
    );

    navigate("/horario");
  };

  const irAdministracion = () => {
    navigate("/admin");
  };

  return (
    <div className="inicio">

      <div className="tarjeta">

        <h1>
          Sistema de Reservas AIP
        </h1>

        <h2>
          Aula de Innovación Pedagógica
        </h2>

        <p>
          Ingrese su nombre completo para
          realizar una reserva.
        </p>

        <label htmlFor="profesor">
          Nombre completo
        </label>

        <input
          id="profesor"
          type="text"
          value={profesor}
          onChange={(e) =>
            setProfesor(e.target.value)
          }
          placeholder="Ejemplo: Juan Pérez"
        />

        <button
          onClick={continuar}
        >
          CONTINUAR
        </button>

        <button
          className="boton-administracion"
          onClick={irAdministracion}
        >
          ADMINISTRACIÓN
        </button>

      </div>

    </div>
  );
}

export default Inicio;