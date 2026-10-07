import {
  Request,
  Response,
  NextFunction
} from "express";

import jwt from "jsonwebtoken";

export function verificarAdministrador(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      mensaje:
        "No autorizado."
    });
  }

  const token =
    authorization.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      mensaje:
        "Token no proporcionado."
    });
  }

  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error(
      "ERROR: JWT_SECRET no está configurada."
    );

    return res.status(500).json({
      mensaje:
        "La autenticación del servidor no está configurada."
    });
  }

  try {
    const payload =
      jwt.verify(
        token,
        jwtSecret
      );

    /*
    |--------------------------------------------------------------------------
    | VERIFICAR QUE SEA ADMINISTRADOR
    |--------------------------------------------------------------------------
    */

    if (
      typeof payload !== "object" ||
      payload === null ||
      payload.rol !== "administrador"
    ) {
      return res.status(403).json({
        mensaje:
          "No tiene permisos de administrador."
      });
    }

    next();

  } catch (error) {
    return res.status(401).json({
      mensaje:
        "La sesión de administrador no es válida o ha expirado."
    });
  }
}