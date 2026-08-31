import { authRequest } from "./client";
import type { LoginInput, PrivateUser, RegisterInput } from "./types";

export function register(input: RegisterInput): Promise<{ user: PrivateUser }> {
  return authRequest<{ user: PrivateUser }>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function login(input: LoginInput): Promise<{ user: PrivateUser }> {
  return authRequest<{ user: PrivateUser }>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function logout(): Promise<{ message: string }> {
  return authRequest<{ message: string }>("/auth/logout", { method: "POST" });
}
