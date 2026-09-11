import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./modules/user/user.routes";
import friendRoutes from "./modules/friend/friend.routes";
import internalRoutes from "./modules/internal/internal.routes";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

// friendRoutes must be mounted before userRoutes — otherwise its literal
// segments (/search, /friends, /friend-requests) would be swallowed by
// userRoutes' GET /users/:id, which matches any single path segment.
app.use("/users", friendRoutes);
app.use("/users", userRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
