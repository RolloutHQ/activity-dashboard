import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import app from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const clientDistDir = path.join(rootDir, "dist", "client");

const port = Number.parseInt(process.env.PORT || "4000", 10);
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  app.use(express.static(clientDistDir));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
