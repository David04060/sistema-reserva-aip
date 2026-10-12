import { Link } from "react-router-dom";

export default function Marca() {
  return (
    <Link className="marca" to="/" aria-label="AIP · Ir al inicio">
      <span className="marca-icono" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4M7 9h4M7 12h7" />
        </svg>
      </span>
      <span>
        AIP<span className="marca-subtitulo">Aula de Innovación Pedagógica</span>
      </span>
    </Link>
  );
}
