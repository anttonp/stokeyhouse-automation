import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, 'stokeyhouse.db'), (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err);
  } else {
    console.log('[DB] Connected to SQLite database');
  }
});

export function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caption TEXT NOT NULL,
      narrativeBeat TEXT,
      photoGuidance TEXT,
      postingTime TEXT,
      bufferScheduleId TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('[DB] Error creating table:', err);
    } else {
      console.log('[DB] Posts table ready');
    }
  });
}

export function getLastPost() {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM posts ORDER BY timestamp DESC LIMIT 1',
      (err, row) => {
        if (err) {
          console.error('[DB] Error fetching last post:', err);
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

export function savePost(postData) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO posts (caption, narrativeBeat, photoGuidance, postingTime, bufferScheduleId, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        postData.caption,
        postData.narrativeBeat,
        postData.photoGuidance,
        postData.postingTime,
        postData.bufferScheduleId,
        postData.timestamp
      ],
      function(err) {
        if (err) {
          console.error('[DB] Error saving post:', err);
          reject(err);
        } else {
          console.log('[DB] Post saved with ID:', this.lastID);
          resolve(this.lastID);
        }
      }
    );
  });
}

export function getAllPosts() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM posts ORDER BY timestamp DESC',
      (err, rows) => {
        if (err) {
          console.error('[DB] Error fetching all posts:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}
