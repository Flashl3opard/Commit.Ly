import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import githubRoutes from "./modules/github/github.routes";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use("/github", githubRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
