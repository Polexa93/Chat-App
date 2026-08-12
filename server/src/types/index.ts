import { Request } from 'express';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  status?: string;
  lastActive?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithoutPassword {
  id: number;
  name: string;
  email: string;
  status?: string;
  lastActive?: string | null;
  avatarUrl?: string | null;
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

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  text: string;
  createdAt: string;
}

export interface CreateMessageData {
  receiverId: number;
  text: string;
}

export interface MessageWithSender {
  id: number;
  senderId: number;
  receiverId: number;
  text: string;
  createdAt: string;
  senderName: string;
}

