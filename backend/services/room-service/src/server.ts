import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4003;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
