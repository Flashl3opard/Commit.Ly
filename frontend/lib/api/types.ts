export type PrivateUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  customStatus: string | null;
  githubUsername: string | null;
  githubVerified: boolean;
  profileCompleted: boolean;
  skills: string[];
  createdAt: string;
  updatedAt: string;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  customStatus: string | null;
  githubUsername: string | null;
  githubVerified: boolean;
  skills: string[];
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
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: string;
  location: string;
  customStatus: string;
  skills: string[];
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
