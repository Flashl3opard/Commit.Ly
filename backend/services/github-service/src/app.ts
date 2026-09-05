import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import githubRoutes from "./modules/github/github.routes";
import githubAppRoutes from "./modules/github-app/githubApp.routes";

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
app.use("/github/app", githubAppRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
