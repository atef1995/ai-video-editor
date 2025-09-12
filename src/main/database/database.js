const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs').promises;

class Database {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  async initialize() {
    try {
      // Create database directory
      const userDataPath = app.getPath('userData');
      const dbDir = path.join(userDataPath, 'database');
      
      await fs.mkdir(dbDir, { recursive: true });
      
      this.dbPath = path.join(dbDir, 'ai-video-editor.db');
      
      // Open database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
        console.log('Connected to SQLite database at:', this.dbPath);
      });

      // Create tables
      await this.createTables();
      
      return { success: true, dbPath: this.dbPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const tableQueries = [
        // Projects table
        `CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          video_path TEXT NOT NULL,
          video_duration REAL,
          video_size INTEGER,
          thumbnail_path TEXT,
          status TEXT DEFAULT 'created',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Transcripts table
        `CREATE TABLE IF NOT EXISTS transcripts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          language TEXT,
          confidence REAL,
          full_text TEXT,
          file_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`,

        // Transcript segments table
        `CREATE TABLE IF NOT EXISTS transcript_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transcript_id INTEGER,
          segment_index INTEGER,
          start_time REAL,
          end_time REAL,
          text TEXT,
          confidence REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (transcript_id) REFERENCES transcripts (id) ON DELETE CASCADE
        )`,

        // Content analysis table
        `CREATE TABLE IF NOT EXISTS content_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          analysis_type TEXT,
          analysis_data TEXT,
          engagement_scores TEXT,
          topics TEXT,
          key_moments TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`,

        // Generated clips table
        `CREATE TABLE IF NOT EXISTS clips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          name TEXT,
          file_path TEXT,
          thumbnail_path TEXT,
          start_time REAL,
          end_time REAL,
          duration REAL,
          engagement_score INTEGER,
          description TEXT,
          topics TEXT,
          aspect_ratio TEXT DEFAULT '9:16',
          status TEXT DEFAULT 'generated',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`,

        // Processing jobs table
        `CREATE TABLE IF NOT EXISTS processing_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          job_type TEXT,
          status TEXT DEFAULT 'pending',
          progress REAL DEFAULT 0,
          error_message TEXT,
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`,

        // Settings table
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      const indexQueries = [
        // Create indexes for better performance  
        `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`,
        `CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips(project_id)`,
        `CREATE INDEX IF NOT EXISTS idx_clips_engagement ON clips(engagement_score DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_segments_transcript_id ON transcript_segments(transcript_id)`,
        `CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status)`
      ];

      // First create all tables, then create indexes
      this.db.serialize(() => {
        // Create tables
        tableQueries.forEach((query) => {
          this.db.run(query);
        });
        
        // Then create indexes after tables exist
        indexQueries.forEach((query) => {
          this.db.run(query);
        });
        
        console.log('All database tables and indexes created successfully');
        resolve();
      });
    });
  }

  // Project management methods
  async createProject(projectData) {
    const { name, videoPath, videoDuration, videoSize, thumbnailPath } = projectData;
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO projects (name, video_path, video_duration, video_size, thumbnail_path)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [name, videoPath, videoDuration, videoSize, thumbnailPath], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getProjects(limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM projects
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(query, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getProject(projectId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM projects WHERE id = ?';
      
      this.db.get(query, [projectId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updateProject(projectId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE projects 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [...values, projectId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Clip management methods
  async saveClip(clipData) {
    const {
      projectId, name, filePath, thumbnailPath, startTime, endTime,
      duration, engagementScore, description, topics, aspectRatio
    } = clipData;
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO clips (
          project_id, name, file_path, thumbnail_path, start_time, end_time,
          duration, engagement_score, description, topics, aspect_ratio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const topicsJson = Array.isArray(topics) ? JSON.stringify(topics) : topics;
      
      this.db.run(query, [
        projectId, name, filePath, thumbnailPath, startTime, endTime,
        duration, engagementScore, description, topicsJson, aspectRatio
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getClips(projectId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM clips 
        WHERE project_id = ? 
        ORDER BY engagement_score DESC, created_at DESC
      `;
      
      this.db.all(query, [projectId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse JSON fields
          const clipsWithParsedTopics = rows.map(clip => ({
            ...clip,
            topics: clip.topics ? JSON.parse(clip.topics) : []
          }));
          resolve(clipsWithParsedTopics);
        }
      });
    });
  }

  // Settings methods
  async getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT value FROM settings WHERE key = ?';
      
      this.db.get(query, [key], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.value : defaultValue);
        }
      });
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [key, value], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { Database };