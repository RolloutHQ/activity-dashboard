import "dotenv/config";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

import { getDashboardSummary, listCredentials } from "./dashboard-service.js";

const app = express();
app.use(cors());
app.use(express.json());

function requireEnv(value, name) {
  if (!value) {
    const error = new Error(`${name} is required`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get("/api/config", async (_req, res, next) => {
  try {
    const credentials = await listCredentials();
    const fallbackAppKey = credentials.find((item) => item.appKey)?.appKey || "";

    res.json({
      rolloutApiBaseUrl: process.env.ROLLOUT_API_BASE_URL || "https://universal.rollout.com/api",
      rolloutAppKey: process.env.ROLLOUT_APP_KEY || fallbackAppKey,
      defaultUserId: process.env.ROLLOUT_USER_ID || "user123",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rollout/token", (req, res, next) => {
  try {
    const userId = String(req.query.userId || process.env.ROLLOUT_USER_ID || "user123");

    const rolloutClientSecret = requireEnv(process.env.ROLLOUT_CLIENT_SECRET, "ROLLOUT_CLIENT_SECRET");
    const rolloutProjectKey = process.env.ROLLOUT_PROJECT_KEY || process.env.ROLLOUT_CLIENT_ID;
    requireEnv(rolloutProjectKey, "ROLLOUT_PROJECT_KEY or ROLLOUT_CLIENT_ID");

    // Rollout docs require HS512 and issuer/subject claims.
    const token = jwt.sign({}, rolloutClientSecret, {
      algorithm: "HS512",
      issuer: rolloutProjectKey,
      subject: userId,
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

app.get("/api/credentials", async (_req, res, next) => {
  try {
    const credentials = await listCredentials();
    res.json({ credentials });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard/summary", async (req, res, next) => {
  try {
    const credentialId = String(req.query.credentialId || "").trim();
    const metric = String(req.query.metric || "contactsMade");
    const rangeDays = String(req.query.rangeDays || "90");

    if (!credentialId) {
      res.status(400).json({ error: "credentialId is required" });
      return;
    }

    const summary = await getDashboardSummary({
      credentialId,
      metricKey: metric,
      rangeDays,
    });

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  const message = error.message || "Unexpected server error";
  res.status(status).json({ error: message });
});

export default app;
