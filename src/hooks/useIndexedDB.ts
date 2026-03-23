/**
 * useIndexedDB — React hook for document & session persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllDocuments,
  saveDocument,
  deleteDocument as deleteDoc,
  getAllSessions,
  saveSession,
  deleteSession,
} from '../lib/storage/db';
import { parsePDF } from '../lib/pdf/parser';
import { chunkDocument } from '../lib/pdf/chunker';
import type { StoredDocument, DocumentChunk, ChatSession } from '../types';

export function useDocuments() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addPDF = useCallback(async (file: File): Promise<DocumentChunk[]> => {
    setLoading(true);
    try {
      const parsed = await parsePDF(file);
      const chunks = chunkDocument(parsed);
      const doc: StoredDocument = {
        filename: parsed.filename,
        hash: parsed.hash,
        chunks,
        totalPages: parsed.totalPages,
        addedAt: Date.now(),
      };
      await saveDocument(doc);
      await refresh();
      return chunks;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const removePDF = useCallback(async (filename: string) => {
    await deleteDoc(filename);
    await refresh();
  }, [refresh]);

  const getAllChunks = useCallback((): DocumentChunk[] => {
    return documents.flatMap(d => d.chunks);
  }, [documents]);

  return { documents, loading, addPDF, removePDF, getAllChunks, refresh };
}

export function useSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const refresh = useCallback(async () => {
    const s = await getAllSessions();
    setSessions(s);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (session: ChatSession) => {
    await saveSession(session);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteSession(id);
    await refresh();
  }, [refresh]);

  return { sessions, save, remove, refresh };
}
