export type PrivateUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UpdateProfileInput = Partial<{
  username: string;
  avatarUrl: string;
  customStatus: string;
}>;

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}
