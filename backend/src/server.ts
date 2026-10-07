import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import "./database";
import reservasRouter from "./routes/reservas";

dotenv.config();

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

/*
|--------------------------------------------------------------------------
| SEGURIDAD HTTP
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

/*
|--------------------------------------------------------------------------
| LÍMITE DE TAMAÑO DE PETICIONES
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "100kb"
  })
);

/*
|--------------------------------------------------------------------------
| LIMITADOR DE LOGIN
|--------------------------------------------------------------------------
|
| Máximo 5 intentos cada 15 minutos desde una misma IP.
|
*/

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    mensaje:
      "Demasiados intentos de inicio de sesión. Intente nuevamente más tarde."
  }
});

/*
|--------------------------------------------------------------------------
| RUTA PRINCIPAL
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    mensaje:
      "Servidor del sistema de reservas AIP funcionando"
  });
});

/*
|--------------------------------------------------------------------------
| LOGIN ADMINISTRADOR
|--------------------------------------------------------------------------
*/

app.post(
  "/admin/login",
  loginLimiter,
  (req, res) => {
    const { password } = req.body;

    const passwordCorrecta =
      process.env.ADMIN_PASSWORD;

    const jwtSecret =
      process.env.JWT_SECRET;

    if (
      !passwordCorrecta ||
      !jwtSecret
    ) {
      console.error(
        "ERROR: Las variables de autenticación no están configuradas."
      );

      return res.status(500).json({
        mensaje:
          "La autenticación del servidor no está configurada."
      });
    }

    if (
      typeof password !== "string" ||
      password.length === 0
    ) {
      return res.status(400).json({
        mensaje:
          "Debe ingresar una contraseña."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | LÍMITE DE LONGITUD DE CONTRASEÑA
    |--------------------------------------------------------------------------
    */

    if (password.length > 200) {
      return res.status(400).json({
        mensaje:
          "La contraseña no es válida."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | COMPROBAR CONTRASEÑA
    |--------------------------------------------------------------------------
    */

    if (
      password !== passwordCorrecta
    ) {
      return res.status(401).json({
        mensaje:
          "Contraseña incorrecta."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR TOKEN JWT
    |--------------------------------------------------------------------------
    */

    const token = jwt.sign(
      {
        rol: "administrador"
      },
      jwtSecret,
      {
        expiresIn: "2h"
      }
    );

    return res.json({
      mensaje:
        "Inicio de sesión correcto.",
      token
    });
  }
);

/*
|--------------------------------------------------------------------------
| RUTAS DE RESERVAS
|--------------------------------------------------------------------------
*/

app.use(
  "/reservas",
  reservasRouter
);

/*
|--------------------------------------------------------------------------
| RUTA NO ENCONTRADA
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {
    res.status(404).json({
      mensaje:
        "La ruta solicitada no existe."
    });
  }
);

/*
|--------------------------------------------------------------------------
| MANEJO GLOBAL DE ERRORES
|--------------------------------------------------------------------------
*/

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(
      "Error interno:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      mensaje:
        "Ocurrió un error interno en el servidor."
    });
  }
);

/*
|--------------------------------------------------------------------------
| INICIAR SERVIDOR
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Servidor ejecutándose en el puerto ${PORT}`
    );
  }
);