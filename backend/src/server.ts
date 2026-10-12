import express from "express";
import cors from "cors";
import helmet from "helmet";
import "./config";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import "./database";
import reservasRouter from "./routes/reservas";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  express.json({
    limit: "100kb",
  }),
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  message: {
    mensaje: "Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.",
  },
});

app.get("/", (_req, res) => {
  res.json({
    mensaje: "Servidor del sistema de reservas AIP funcionando",
  });
});

app.post("/admin/login", loginLimiter, (req, res) => {
  const { password } = req.body ?? {};

  const passwordCorrecta = process.env.ADMIN_PASSWORD;

  const jwtSecret = process.env.JWT_SECRET;

  if (!passwordCorrecta || !jwtSecret) {
    console.error("ERROR: Las variables de autenticación no están configuradas.");

    return res.status(500).json({
      mensaje: "La autenticación del servidor no está configurada.",
    });
  }

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({
      mensaje: "Debe ingresar una contraseña.",
    });
  }

  if (password.length > 200) {
    return res.status(400).json({
      mensaje: "La contraseña no es válida.",
    });
  }

  if (password !== passwordCorrecta) {
    return res.status(401).json({
      mensaje: "Contraseña incorrecta.",
    });
  }

  const token = jwt.sign(
    {
      rol: "administrador",
    },
    jwtSecret,
    {
      expiresIn: "2h",
    },
  );

  return res.json({
    mensaje: "Inicio de sesión correcto.",
    token,
  });
});

app.use("/reservas", reservasRouter);

app.use((_req, res) => {
  res.status(404).json({
    mensaje: "La ruta solicitada no existe.",
  });
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }

    const tipo = (error as { type?: string } | null)?.type;
    if (tipo === "entity.parse.failed") {
      return res.status(400).json({ mensaje: "El cuerpo de la petición contiene JSON inválido." });
    }
    if (tipo === "entity.too.large") {
      return res.status(413).json({ mensaje: "La petición supera el tamaño permitido." });
    }

    console.error("Error interno:", error);

    return res.status(500).json({
      mensaje: "Ocurrió un error interno en el servidor.",
    });
  },
);

if (require.main === module)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  });

export default app;
