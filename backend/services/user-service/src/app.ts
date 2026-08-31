import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./modules/user/user.routes";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use("/users", userRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
