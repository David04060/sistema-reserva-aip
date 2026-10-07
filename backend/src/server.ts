import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./database";
import reservasRouter from "./routes/reservas";

dotenv.config();

const app = express();

const PORT = 3000;

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    mensaje:
      "Servidor del sistema de reservas AIP funcionando"
  });
});

app.use("/reservas", reservasRouter);

app.listen(PORT, () => {
  console.log(
    `Servidor ejecutándose en http://localhost:${PORT}`
  );
});