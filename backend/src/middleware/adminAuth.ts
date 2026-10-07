import { Request, Response, NextFunction } from "express";

export function verificarAdministrador(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const contraseña =
    req.headers["x-admin-password"];

  const contraseñaCorrecta =
    process.env.ADMIN_PASSWORD;

  if (
    typeof contraseña !== "string" ||
    !contraseñaCorrecta ||
    contraseña !== contraseñaCorrecta
  ) {
    return res.status(401).json({
      mensaje:
        "No autorizado. Se requiere acceso de administrador."
    });
  }

  next();
}