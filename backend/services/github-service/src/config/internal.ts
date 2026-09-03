const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

if (!INTERNAL_SERVICE_SECRET) {
  throw new Error("INTERNAL_SERVICE_SECRET environment variable is not set");
}
if (!USER_SERVICE_URL) {
  throw new Error("USER_SERVICE_URL environment variable is not set");
}

export const internalConfig = {
  serviceSecret: INTERNAL_SERVICE_SECRET,
  userServiceUrl: USER_SERVICE_URL,
};
