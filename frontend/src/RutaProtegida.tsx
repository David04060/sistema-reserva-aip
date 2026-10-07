import { Navigate, Outlet } from "react-router-dom";

function RutaProtegida() {
  const profesor = localStorage.getItem("profesor");

  if (!profesor || profesor.trim() === "") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default RutaProtegida;