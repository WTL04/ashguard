// lib/forumData.ts
// Shared types and Firestore helpers for the forum.
// Place this file at:  <project-root>/lib/forumData.ts

import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // adjust path if your firebase init lives elsewhere

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThreadType = 'official' | 'wildfire' | 'prescribed' | 'resource' | 'question';

export interface ForumThread {
  id: string;                 // Firestore document id
  type: ThreadType;
  distance: string;
  title?: string;
  pinned?: boolean;
  authorId: string;
  authorUsername: string;
  authorDate: string;         // human-readable, derived from createdAt
  body: string;
  tags: string[];             // array of tag label strings
  createdAt: Timestamp | null;
}

export interface ForumComment {
  id: string;
  parentId: string | null;    // null = top-level comment
  authorId: string;
  authorUsername: string;
  avatarColor: string;
  text: string;
  createdAt: Timestamp | null;
  timeAgo: string;            // derived on client from createdAt
}

// ── Display config ────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<ThreadType, string> = {
  official:   'Official Notice',
  wildfire:   'Wild Fire',
  prescribed: 'Prescribed Fire',
  resource:   'Resource',
  question:   'Question',
};

export const OFFICIAL_STYLE = {
  border:   '#FCD34D',
  bg:       '#FFFBEB',
  tagBg:    '#FEF3C7',
  tagColor: '#B45309',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive a ThreadType from an array of tag labels. */
export function tagsToType(tags: string[]): ThreadType {
  if (tags.includes('Official'))  return 'official';
  if (tags.includes('Resources')) return 'resource';
  if (tags.includes('Question'))  return 'question';
  return 'wildfire';
}

/** Format a Firestore Timestamp into a short human-readable string. */
export function formatTimeAgo(ts: Timestamp | null): string {
  if (!ts) return 'just now';
  const diffMs = Date.now() - ts.toMillis();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}hr ago`;
  return ts.toDate().toLocaleDateString();
}

/** Format a Timestamp into "Mar 13, 2026 · 6:02 AM" style. */
export function formatPostDate(ts: Timestamp | null): string {
  if (!ts) return '';
  return ts.toDate().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Return a date-group label ("Today", "Yesterday", or "Mon, Mar 13"). */
export function dateGroupLabel(ts: Timestamp | null): string {
  if (!ts) return 'Today';
  const d = ts.toDate();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Firestore reads ───────────────────────────────────────────────────────────

/**
 * Subscribe to all threads in real-time, ordered newest-first.
 * Returns an unsubscribe function.
 */
export function subscribeToThreads(
  onData: (threads: ForumThread[]) => void,
): () => void {
  const q = query(collection(db, 'threads'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const threads: ForumThread[] = snap.docs.map((d) => {
      const data = d.data();
      const ts: Timestamp | null = data.createdAt ?? null;
      return {
        id: d.id,
        type: data.type ?? 'wildfire',
        distance: data.distance ?? '—',
        title: data.title,
        pinned: data.pinned ?? false,
        authorId: data.authorId ?? '',
        authorUsername: data.authorUsername ?? 'Anonymous',
        authorDate: formatPostDate(ts),
        body: data.body ?? '',
        tags: data.tags ?? [],
        createdAt: ts,
      };
    });
    onData(threads);
  });
}

/**
 * Subscribe to comments for a thread in real-time, ordered oldest-first.
 * Returns an unsubscribe function.
 */
export function subscribeToComments(
  threadId: string,
  onData: (comments: ForumComment[]) => void,
): () => void {
  const q = query(
    collection(db, 'threads', threadId, 'comments'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const comments: ForumComment[] = snap.docs.map((d) => {
      const data = d.data();
      const ts: Timestamp | null = data.createdAt ?? null;
      return {
        id: d.id,
        parentId: data.parentId ?? null,
        authorId: data.authorId ?? '',
        authorUsername: data.authorUsername ?? 'Anonymous',
        avatarColor: data.avatarColor ?? '#6B7280',
        text: data.text ?? '',
        createdAt: ts,
        timeAgo: formatTimeAgo(ts),
      };
    });
    onData(comments);
  });
}

// ── Firestore writes ──────────────────────────────────────────────────────────

/**
 * Create a new thread document in Firestore.
 * Returns the new document id.
 */
export async function createThread(params: {
  title: string;
  address: string;
  body: string;
  tags: string[];
  authorId: string;
  authorUsername: string;
  avatarColor: string;
}): Promise<string> {
  const type = tagsToType(params.tags);
  const ref = await addDoc(collection(db, 'threads'), {
    type,
    distance: '—',                  // real distance requires geolocation — hook up later
    title: params.title || null,
    pinned: false,
    authorId: params.authorId,
    authorUsername: params.authorUsername,
    avatarColor: params.avatarColor,
    body: params.body,
    address: params.address,
    tags: params.tags,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Post a comment (or reply) on a thread.
 */
export async function postComment(params: {
  threadId: string;
  parentId: string | null;
  authorId: string;
  authorUsername: string;
  avatarColor: string;
  text: string;
}): Promise<void> {
  await addDoc(collection(db, 'threads', params.threadId, 'comments'), {
    parentId: params.parentId,
    authorId: params.authorId,
    authorUsername: params.authorUsername,
    avatarColor: params.avatarColor,
    text: params.text,
    createdAt: serverTimestamp(),
  });
}