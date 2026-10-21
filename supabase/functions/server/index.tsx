import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Restrict CORS using ALLOWED_ORIGIN env variable with local dev fallback
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:8443";

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigin;
      if (allowedOrigin === "*" || origin === allowedOrigin) return origin;
      // Allow local development ports
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return origin;
      }
      return allowedOrigin;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint (public)
app.get("/make-server-c1f42330/health", (c) => {
  return c.json({ status: "ok", service: "toolshed-rentals" });
});

Deno.serve(app.fetch);