import { Request } from 'express';
import { Database } from 'sqlite3';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithoutPassword {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: UserWithoutPassword;
  };
}

export interface JwtPayload {
  id: number;
}

export interface AuthRequest extends Request {
  user?: UserWithoutPassword;
}

export interface DatabaseResult {
  lastID: number;
  changes: number;
}

