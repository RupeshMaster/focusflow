/**
 * storage.js
 * Handles all IndexedDB interactions for offline data persistence.
 */

const DB_NAME = 'StudyPlannerDB';
const DB_VERSION = 1;

class StorageManager {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        // Create object stores
        if (!this.db.objectStoreNames.contains('profile')) {
          this.db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!this.db.objectStoreNames.contains('subjects')) {
          this.db.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
        }
        if (!this.db.objectStoreNames.contains('timetables')) {
          this.db.createObjectStore('timetables', { keyPath: 'date' });
        }
        if (!this.db.objectStoreNames.contains('notes')) {
          this.db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Generic Helper for Transactions
  async _tx(storeName, mode, callback) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      // For read requests that return immediately
      if (request && request.onsuccess) {
        request.onsuccess = () => resolve(request.result);
      }
    });
  }

  // --- Profile ---
  async saveProfile(profile) {
    profile.id = 'user_profile'; // Singleton
    return this._tx('profile', 'readwrite', store => store.put(profile));
  }

  async getProfile() {
    return this._tx('profile', 'readonly', store => store.get('user_profile'));
  }

  // --- Subjects ---
  async saveSubject(subject) {
    return this._tx('subjects', 'readwrite', store => store.put(subject));
  }

  async getAllSubjects() {
    return this._tx('subjects', 'readonly', store => store.getAll());
  }

  async deleteSubject(id) {
    return this._tx('subjects', 'readwrite', store => store.delete(id));
  }

  // --- Timetables ---
  async saveTimetable(timetable) {
    return this._tx('timetables', 'readwrite', store => store.put(timetable));
  }

  async getTimetable(date) {
    // date string YYYY-MM-DD
    return this._tx('timetables', 'readonly', store => store.get(date));
  }

  async getAllTimetables() {
    return this._tx('timetables', 'readonly', store => store.getAll());
  }

  // --- Notes ---
  async saveNote(note) {
    // note: { id, content, timestamp, subjectId (optional) }
    if (!note.timestamp) note.timestamp = new Date().toISOString();
    return this._tx('notes', 'readwrite', store => store.put(note));
  }

  async getAllNotes() {
    return this._tx('notes', 'readonly', store => store.getAll());
  }

  async deleteNote(id) {
    return this._tx('notes', 'readwrite', store => store.delete(id));
  }
}

export const db = new StorageManager();
