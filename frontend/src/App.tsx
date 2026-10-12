import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Inicio from "./pages/Inicio";
import Horario from "./pages/Horario";
import RutaProtegida from "./RutaProtegida";
import Admin from "./pages/Admin";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />

        <Route element={<RutaProtegida />}>
          <Route path="/horario" element={<Horario />} />
        </Route>

        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
