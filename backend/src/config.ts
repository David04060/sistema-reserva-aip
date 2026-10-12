import path from "path";
import dotenv from "dotenv";

// Resolver .env desde el backend permite arrancar desde cualquier directorio.
dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });
