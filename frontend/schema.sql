
CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id TEXT NOT NULL,
    profesor TEXT NOT NULL,
    area TEXT NOT NULL,
    grado TEXT NOT NULL,
    seccion TEXT NOT NULL,
    dia TEXT NOT NULL,
    fecha_programada TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL CHECK (hora_inicio < hora_fin),
    fecha_reserva TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservas_fecha_hora
ON reservas (
    fecha_programada,
    hora_inicio,
    hora_fin
);

CREATE INDEX IF NOT EXISTS idx_reservas_grupo
ON reservas (grupo_id);

CREATE TRIGGER IF NOT EXISTS impedir_reservas_superpuestas
BEFORE INSERT ON reservas
WHEN EXISTS (
    SELECT 1
    FROM reservas
    WHERE fecha_programada = NEW.fecha_programada
      AND hora_inicio < NEW.hora_fin
      AND hora_fin > NEW.hora_inicio
)
BEGIN
    SELECT RAISE(ABORT, 'HORARIO_OCUPADO');
END;

-- Protect maintenance UPDATEs too, excluding the row being updated.
CREATE TRIGGER IF NOT EXISTS impedir_actualizaciones_superpuestas
BEFORE UPDATE OF fecha_programada, hora_inicio, hora_fin ON reservas
WHEN EXISTS (
    SELECT 1 FROM reservas
    WHERE id <> OLD.id
      AND fecha_programada = NEW.fecha_programada
      AND hora_inicio < NEW.hora_fin
      AND hora_fin > NEW.hora_inicio
)
BEGIN
    SELECT RAISE(ABORT, 'HORARIO_OCUPADO');
END;
