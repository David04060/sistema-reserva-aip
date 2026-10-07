import { BrowserRouter, Routes, Route } from "react-router-dom";

import Inicio from "./pages/Inicio";
import Horario from "./pages/Horario";
import RutaProtegida from "./RutaProtegida";
import Admin from "./pages/Admin";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Inicio />}
        />

        <Route element={<RutaProtegida />}>

          <Route
            path="/horario"
            element={<Horario />}
          />

        </Route>

        <Route
          path="/admin"
          element={<Admin />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;