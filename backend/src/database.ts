import Database from "better-sqlite3";

const db = new Database("database.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id TEXT,
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

/*
  Si la base de datos ya existía antes de agregar grupo_id,
  SQLite no tendrá esa columna.

  Intentamos agregarla.
  Si ya existe, simplemente continuamos.
*/
try {
  db.exec(`
    ALTER TABLE reservas
    ADD COLUMN grupo_id TEXT
  `);
} catch (error) {
  // La columna ya existe. No hacemos nada.
}

/*
  Las reservas antiguas que no tenían grupo_id
  reciben un grupo independiente.

  De esta manera no se pierde ninguna reserva existente.
*/
db.exec(`
  UPDATE reservas
  SET grupo_id = 'legacy-' || id
  WHERE grupo_id IS NULL
`);

export default db;