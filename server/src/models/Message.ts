import { dbRun, dbAll, dbGet } from '../config/database';
import { Message, CreateMessageData, MessageWithSender } from '../types';
import User from './User';

class MessageModel {
  static async create(messageData: CreateMessageData, senderId: number): Promise<Message> {
    const { receiverId, text } = messageData;

    try {
      const result = await dbRun(
        'INSERT INTO messages (senderId, receiverId, text) VALUES (?, ?, ?)',
        [senderId, receiverId, text]
      );

      const message = await this.findById(result.lastID);
      if (!message) {
        throw new Error('Failed to create message');
      }
      return message;
    } catch (error) {
      throw error;
    }
  }

  static async findById(id: number): Promise<Message | null> {
    const message = await dbGet<Message>('SELECT * FROM messages WHERE id = ?', [id]);
    return message || null;
  }

  static async getConversation(
    userId1: number,
    userId2: number
  ): Promise<MessageWithSender[]> {
    const messages = await dbAll<Message & { senderName: string }>(
      `SELECT m.*, u.name as senderName
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
       ORDER BY m.createdAt ASC`,
      [userId1, userId2, userId2, userId1]
    );

    return messages.map(({ senderName, ...message }) => ({
      ...message,
      senderName,
    }));
  }

  static async getMessagesForUser(userId: number): Promise<MessageWithSender[]> {
    const messages = await dbAll<Message & { senderName: string }>(
      `SELECT m.*, u.name as senderName
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.receiverId = ? OR m.senderId = ?
       ORDER BY m.createdAt DESC
       LIMIT 100`,
      [userId, userId]
    );

    return messages.map(({ senderName, ...message }) => ({
      ...message,
      senderName,
    }));
  }

  static async getConversationPartners(userId: number): Promise<Array<{ id: number; name: string; email: string; lastMessage: string; lastMessageTime: string }>> {
    // Get all messages where user is sender or receiver
    const allMessages = await dbAll<Message>(
      `SELECT * FROM messages 
       WHERE senderId = ? OR receiverId = ?
       ORDER BY createdAt DESC`,
      [userId, userId]
    );

    // Get unique partner IDs
    const partnerIds = new Set<number>();
    const messageMap = new Map<number, { text: string; time: string }>();

    for (const msg of allMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      partnerIds.add(partnerId);
      
      // Keep track of most recent message with each partner
      if (!messageMap.has(partnerId) || new Date(msg.createdAt) > new Date(messageMap.get(partnerId)!.time)) {
        messageMap.set(partnerId, { text: msg.text, time: msg.createdAt });
      }
    }

    // Fetch user details for all partners
    const partners: Array<{ id: number; name: string; email: string; lastMessage: string; lastMessageTime: string }> = [];
    
    for (const partnerId of partnerIds) {
      const partner = await User.findById(partnerId);
      if (partner) {
        const lastMsg = messageMap.get(partnerId);
        partners.push({
          id: partner.id,
          name: partner.name,
          email: partner.email,
          lastMessage: lastMsg?.text || 'No messages yet',
          lastMessageTime: lastMsg?.time || new Date().toISOString(),
        });
      }
    }

    // Sort by last message time (most recent first)
    return partners.sort((a, b) => 
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
  }
}

export default MessageModel;

