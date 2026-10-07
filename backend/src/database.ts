import Database from "better-sqlite3";
import path from "path";

const databasePath =
  process.env.DATABASE_PATH ||
  path.join(
    process.cwd(),
    "database.sqlite"
  );

const db =
  new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

try {
  db.exec(`
    ALTER TABLE reservas
    ADD COLUMN grupo_id TEXT
  `);
} catch (error) {
  // La columna ya existe.
}

db.exec(`
  UPDATE reservas
  SET grupo_id = 'legacy-' || id
  WHERE grupo_id IS NULL
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS
  idx_reservas_fecha_hora
  ON reservas (
    fecha_programada,
    hora_inicio,
    hora_fin
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS
  idx_reservas_grupo
  ON reservas (
    grupo_id
  );
`);

export default db;