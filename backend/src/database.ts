import Database from "better-sqlite3";

const db = new Database("database.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profesor TEXT NOT NULL,
    area TEXT NOT NULL,
    grado TEXT NOT NULL,
    seccion TEXT NOT NULL,
    dia TEXT NOT NULL,
    fecha_programada TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    fecha_reserva TEXT NOT NULL
  )
`);

export default db;