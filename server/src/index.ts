import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import multer from "multer";
import { ZodError } from "zod";

import { db } from "./config/db.js";
import { env } from "./config/env.js";
import { HttpError } from "./utils/errors.js";

// Authentication and administration
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";

// Supplier price list routes
import { priceRouter } from "./features/price/routes.js";
import { aksRouter } from "./features/prices/aks/routes.js";
import { cabacRouter } from './features/prices/cabac/routes.js';
import { carrollRouter } from './features/prices/carroll/routes.js';

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Middleware
app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// API Router
const api = express.Router();

// API root
api.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "cable-price-api",
  });
});

// Health check
api.get("/health", async (_req, res) => {
  await db.query("SELECT 1");

  res.json({
    status: "ok",
    service: "cable-price-api",
  });
});

// Authentication
api.use("/auth", authRouter);

// Administration
api.use("/admin", adminRouter);

// AKS price list
api.use("/price-lists/aks", aksRouter);

// CABAC price list
api.use('/price-lists/cabac', cabacRouter);

// 3F price list
api.use("/price-lists", priceRouter);

// Carroll price list
api.use("/price-lists/carroll", carrollRouter);

// API 404 handler
api.use((_req, _res, next) => {
  next(new HttpError(404, "API route not found"));
});

// Support localhost and cPanel Passenger
app.use("/api", api);
app.use("/", api);

// Global error handler
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "Uploaded file exceeds the allowed size"
          : err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Invalid input",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
    });
    return;
  }

  console.error("[API ERROR]", err);

  res.status(500).json({
    error: "An unexpected server error occurred",
  });
};

app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
  console.log(`Cable Price API listening on port ${env.PORT}`);
});
