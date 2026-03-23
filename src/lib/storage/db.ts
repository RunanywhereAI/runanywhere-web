/**
 * IndexedDB wrapper for chat history + document chunk persistence.
 */

import type { ChatSession, StoredDocument, DocumentChunk } from '../../types';

const DB_NAME = 'privateide';
const DB_VERSION = 1;

const STORES = {
  sessions: 'sessions',
  documents: 'documents',
  preferences: 'preferences',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        db.createObjectStore(STORES.sessions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.documents)) {
        db.createObjectStore(STORES.documents, { keyPath: 'filename' });
      }
      if (!db.objectStoreNames.contains(STORES.preferences)) {
        db.createObjectStore(STORES.preferences, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Sessions ──

export async function getAllSessions(): Promise<ChatSession[]> {
  const store = await txStore(STORES.sessions, 'readonly');
  const sessions = await reqToPromise<ChatSession[]>(store.getAll());
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string): Promise<ChatSession | undefined> {
  const store = await txStore(STORES.sessions, 'readonly');
  return reqToPromise(store.get(id));
}

export async function saveSession(session: ChatSession): Promise<void> {
  const store = await txStore(STORES.sessions, 'readwrite');
  await reqToPromise(store.put(session));
}

export async function deleteSession(id: string): Promise<void> {
  const store = await txStore(STORES.sessions, 'readwrite');
  await reqToPromise(store.delete(id));
}

// ── Documents ──

export async function getAllDocuments(): Promise<StoredDocument[]> {
  const store = await txStore(STORES.documents, 'readonly');
  return reqToPromise(store.getAll());
}

export async function getDocument(filename: string): Promise<StoredDocument | undefined> {
  const store = await txStore(STORES.documents, 'readonly');
  return reqToPromise(store.get(filename));
}

export async function saveDocument(doc: StoredDocument): Promise<void> {
  const store = await txStore(STORES.documents, 'readwrite');
  await reqToPromise(store.put(doc));
}

export async function deleteDocument(filename: string): Promise<void> {
  const store = await txStore(STORES.documents, 'readwrite');
  await reqToPromise(store.delete(filename));
}

export async function getDocumentChunks(filename?: string): Promise<DocumentChunk[]> {
  const docs = filename
    ? [await getDocument(filename)].filter(Boolean) as StoredDocument[]
    : await getAllDocuments();
  return docs.flatMap(d => d.chunks);
}

// ── Preferences ──

export async function getPreference<T>(key: string): Promise<T | undefined> {
  const store = await txStore(STORES.preferences, 'readonly');
  const row = await reqToPromise<{ key: string; value: T } | undefined>(store.get(key));
  return row?.value;
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  const store = await txStore(STORES.preferences, 'readwrite');
  await reqToPromise(store.put({ key, value }));
}
