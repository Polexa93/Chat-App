import { dbRun, dbAll } from '../config/database';
import { UserWithoutPassword } from '../types';

export type ContactWithUser = UserWithoutPassword & { addedAt: string };

class ContactModel {
  static async add(userId: number, contactId: number): Promise<void> {
    if (userId === contactId) {
      throw new Error('You cannot add yourself as a contact');
    }
    await dbRun(
      'INSERT OR IGNORE INTO contacts (userId, contactId) VALUES (?, ?)',
      [userId, contactId]
    );
  }

  static async remove(userId: number, contactId: number): Promise<void> {
    await dbRun(
      'DELETE FROM contacts WHERE userId = ? AND contactId = ?',
      [userId, contactId]
    );
  }

  static async list(userId: number): Promise<ContactWithUser[]> {
    return dbAll<ContactWithUser>(
      `SELECT u.id, u.name, u.email, u.status, u.lastActive, u.avatarUrl, u.createdAt, u.updatedAt, c.createdAt as addedAt
       FROM contacts c
       JOIN users u ON u.id = c.contactId
       WHERE c.userId = ?
       ORDER BY c.createdAt DESC`,
      [userId]
    );
  }
}

export default ContactModel;
