import { dbRun, dbGet, dbAll } from '../config/database';
import bcrypt from 'bcryptjs';
import { User, UserWithoutPassword, CreateUserData } from '../types';

class UserModel {
  static async create(userData: CreateUserData): Promise<UserWithoutPassword> {
    const { name, email, password } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
      const result = await dbRun(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email.toLowerCase().trim(), hashedPassword]
      );

      const user = await this.findById(result.lastID);
      if (!user) {
        throw new Error('Failed to create user');
      }
      return user;
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('UNIQUE constraint failed')) {
        throw new Error('User already exists with this email');
      }
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    const user = await dbGet<User>(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) return null;

    // Remove password from returned user
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findById(id: number): Promise<UserWithoutPassword | null> {
    const user = await dbGet<User>('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) return null;

    // Remove password from returned user
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findByEmailWithPassword(email: string): Promise<User | null> {
    const user = await dbGet<User>(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    return user || null;
  }

  static async matchPassword(enteredPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  }

  static async searchUsers(query: string, excludeUserId: number): Promise<UserWithoutPassword[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const users = await dbAll<User>(
      `SELECT * FROM users 
       WHERE (LOWER(name) LIKE ? OR LOWER(email) LIKE ?) 
       AND id != ? 
       LIMIT 20`,
      [searchTerm, searchTerm, excludeUserId]
    );

    // Remove password from all users
    return users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  }
}

export default UserModel;

