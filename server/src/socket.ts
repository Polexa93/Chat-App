import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User';
import { JwtPayload } from './types';

interface AuthedSocket extends Socket {
  userId?: number;
}

let io: SocketIOServer | null = null;

// Tracks how many active socket connections each user currently has
// (a user can have multiple tabs/devices open at once).
const connectionsByUser = new Map<number, Set<string>>();

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  // Authenticate each socket connection using the same JWT used for REST calls
  io.use(async (socket: AuthedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        next(new Error('Not authorized'));
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      const user = await User.findById(decoded.id);
      if (!user) {
        next(new Error('Not authorized'));
        return;
      }

      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Not authorized'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId as number;
    socket.join(`user:${userId}`);

    const wasOffline = !connectionsByUser.has(userId) || connectionsByUser.get(userId)!.size === 0;
    if (!connectionsByUser.has(userId)) {
      connectionsByUser.set(userId, new Set());
    }
    connectionsByUser.get(userId)!.add(socket.id);

    if (wasOffline) {
      User.updateStatus(userId, 'online').then(() => {
        broadcastPresence(userId, 'online');
      });
    }

    // Client reports its own idle/active state (drives the "away" status)
    socket.on('presence:set', async (status: 'online' | 'away') => {
      if (status !== 'online' && status !== 'away') return;
      await User.updateStatus(userId, status);
      broadcastPresence(userId, status);
    });

    // Typing indicator relay
    socket.on('typing:start', ({ toUserId }: { toUserId: number }) => {
      if (!toUserId) return;
      io!.to(`user:${toUserId}`).emit('typing:start', { fromUserId: userId });
    });

    socket.on('typing:stop', ({ toUserId }: { toUserId: number }) => {
      if (!toUserId) return;
      io!.to(`user:${toUserId}`).emit('typing:stop', { fromUserId: userId });
    });

    socket.on('disconnect', () => {
      const sockets = connectionsByUser.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        connectionsByUser.delete(userId);
        // Presence naturally falls back to "offline" once lastActive goes stale
        // (see utils/presence.js on the client), so nothing else to do here.
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket() first.');
  }
  return io;
};

const broadcastPresence = (userId: number, status: 'online' | 'away') => {
  if (!io) return;
  io.emit('presence:update', { userId, status, lastActive: new Date().toISOString() });
};

// Notify both participants that a new message was sent
export const emitNewMessage = (senderId: number, receiverId: number, message: unknown) => {
  if (!io) return;
  io.to(`user:${senderId}`).to(`user:${receiverId}`).emit('message:new', message);
};
