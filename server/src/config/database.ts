import sqlite3 from 'sqlite3';
import path from 'path';
import { DatabaseResult } from '../types';

const sqlite = sqlite3.verbose();
let db: sqlite3.Database | null = null;

export const connectDB = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    try {
      // Create database file in server directory
      const dbPath = path.join(__dirname, '..', '..', 'chat-app.db');
      db = new sqlite.Database(dbPath, (err) => {
        if (err) {
          console.error(`Database Connection Error: ${err.message}`);
          reject(err);
          return;
        }
        
        console.log('SQLite Database Connected');
        
        // Create users table if it doesn't exist
        db!.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating users table:', err.message);
            reject(err);
            return;
          }
          
          // Create messages table if it doesn't exist
          db!.run(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              senderId INTEGER NOT NULL,
              receiverId INTEGER NOT NULL,
              text TEXT NOT NULL,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (senderId) REFERENCES users(id),
              FOREIGN KEY (receiverId) REFERENCES users(id)
            )
          `, (err) => {
            if (err) {
              console.error('Error creating messages table:', err.message);
              reject(err);
              return;
            }
            console.log('Database tables initialized');
            resolve(db!);
          });
        });
      });
    } catch (error) {
      const err = error as Error;
      console.error(`Database Connection Error: ${err.message}`);
      reject(err);
    }
  });
};

export const getDB = (): sqlite3.Database => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
};

// Promisify common database methods for easier async/await usage
export const dbRun = (sql: string, params: any[] = []): Promise<DatabaseResult> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  return new Promise((resolve, reject) => {
    db!.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  return new Promise((resolve, reject) => {
    db!.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const dbAll = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  return new Promise((resolve, reject) => {
    db!.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

