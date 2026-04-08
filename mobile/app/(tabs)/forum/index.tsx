import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { Colors } from '@/constants/colors';
import {
  ForumThread,
  ForumComment,
  TYPE_LABEL,
  OFFICIAL_STYLE,
  subscribeToThreads,
  subscribeToComments,
  postComment,
  dateGroupLabel,
} from '@/lib/forumData';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(comments: ForumComment[]): Array<{ comment: ForumComment; depth: number }> {
  const result: Array<{ comment: ForumComment; depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    comments
      .filter((c) => c.parentId === parentId)
      .forEach((c) => {
        result.push({ comment: c, depth });
        walk(c.id, depth + 1);
      });
  }
  walk(null, 0);
  return result;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ username, color, size = 34 }: { username: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: size * 0.38 }}>
        {(username?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────

const INDENT = 24;

function CommentRow({
  comment,
  depth,
  onReply,
}: {
  comment: ForumComment;
  depth: number;
  onReply: (id: string, username: string) => void;
}) {
  const avatarSize = depth === 0 ? 34 : 28;
  return (
    <View style={{ paddingLeft: depth * INDENT + 14, paddingRight: 14, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Avatar username={comment.authorUsername} color={comment.avatarColor} size={avatarSize} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
            <Text style={styles.commentUsername}>{comment.authorUsername}</Text>
            <Text style={styles.commentDot}> · </Text>
            <Text style={styles.commentTime}>{comment.timeAgo}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => onReply(comment.id, comment.authorUsername)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={12} color={Colors.primary} />
            <Text style={styles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Thread card ───────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  currentUser,
  onPress,
}: {
  thread: ForumThread;
  currentUser: { uid: string; displayName: string | null; email: string | null } | null;
  onPress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const isOfficial = thread.type === 'official';

  // Subscribe to comments only when expanded
  useEffect(() => {
    if (!expanded) return;
    const unsub = subscribeToComments(thread.id, setComments);
    return unsub;
  }, [expanded, thread.id]);

  const tree = buildTree(comments);

  const handleReply = (id: string, username: string) => {
    setReplyingToId(id);
    setReplyingToName(username);
    setCommentText(`@${username} `);
    setExpanded(true);
  };

  const handlePost = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await postComment({
        threadId: thread.id,
        parentId: replyingToId,
        authorId: currentUser?.uid ?? 'anonymous',
        authorUsername: currentUser?.displayName ?? currentUser?.email ?? 'Anonymous',
        avatarColor: Colors.primary,
        text: trimmed,
      });
      setCommentText('');
      setReplyingToId(null);
      setReplyingToName(null);
      setExpanded(true);
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={[styles.card, isOfficial && styles.cardOfficial]}>
      {/* Header */}
      <TouchableOpacity
        style={[styles.cardHeader, isOfficial && styles.cardHeaderOfficial]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {isOfficial ? (
          <View style={styles.officialHeaderInner}>
            <Ionicons name="pin" size={12} color={OFFICIAL_STYLE.tagColor} />
            <Text style={styles.pinnedLabel}>PINNED NOTICE</Text>
          </View>
        ) : (
          <>
            <Text style={styles.cardHeaderType}>{TYPE_LABEL[thread.type]}</Text>
            <Text style={styles.cardHeaderDistance}>Distance: {thread.distance}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Body */}
      <TouchableOpacity style={styles.cardBody} onPress={onPress} activeOpacity={0.88}>
        {isOfficial && (
          <View style={styles.officialTagPill}>
            <Text style={styles.officialTagText}>OFFICIAL</Text>
          </View>
        )}
        {thread.title ? (
          <Text style={isOfficial ? styles.threadTitle : styles.threadTitleRegular}>
            {thread.title}
          </Text>
        ) : null}
        <View style={styles.authorRow}>
          <Avatar
            username={thread.authorUsername}
            color={isOfficial ? OFFICIAL_STYLE.tagColor : '#6B7280'}
            size={36}
          />
          <View>
            <Text style={styles.authorName}>{thread.authorUsername}</Text>
            <Text style={styles.authorDate}>{thread.authorDate}</Text>
          </View>
        </View>
        <Text style={[styles.fireBody, isOfficial && styles.fireBodyOfficial]}>{thread.body}</Text>
        {!isOfficial && thread.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {thread.tags.map((label, i) => (
              <View key={i} style={styles.tagPill}>
                <Text style={styles.tagText}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Replying-to banner */}
      {replyingToName && (
        <View style={styles.replyingToBar}>
          <Text style={styles.replyingToText}>
            Replying to <Text style={{ fontWeight: '700' }}>@{replyingToName}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => { setReplyingToId(null); setReplyingToName(null); setCommentText(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Comment input */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Comment..."
          placeholderTextColor="#9CA3AF"
          value={commentText}
          onChangeText={setCommentText}
          onSubmitEditing={handlePost}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!commentText.trim() || posting) && { opacity: 0.4 }]}
          onPress={handlePost}
          disabled={!commentText.trim() || posting}
          activeOpacity={0.8}
        >
          {posting
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chevronBtn}
          onPress={() => setExpanded((e) => !e)}
          activeOpacity={0.7}
        >
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Expanded comments */}
      {expanded && (
        <View style={styles.commentsSection}>
          {tree.length === 0 ? (
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          ) : (
            tree.map(({ comment, depth }) => (
              <View key={comment.id}>
                <CommentRow comment={comment} depth={depth} onReply={handleReply} />
                <View style={styles.commentDivider} />
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

// ── Filter config ─────────────────────────────────────────────────────────────

type FilterOption = 'all' | 'pinned' | 'Wildfire' | 'Question' | 'Resources' | 'Self Report' | 'Update';

const FILTER_TABS: { key: FilterOption; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pinned',      label: '📌 Pinned' },
  { key: 'Wildfire',    label: '🔥 Wildfire' },
  { key: 'Question',    label: '❓ Question' },
  { key: 'Resources',   label: '📦 Resources' },
  { key: 'Self Report', label: '🙋 Self Report' },
  { key: 'Update',      label: '📢 Update' },
];

export default function ForumScreen() {
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  useEffect(() => {
    const unsub = subscribeToThreads((data) => {
      setThreads(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const pinnedThreads = threads.filter((t) => t.type === 'official' || t.pinned);

  // Only show pinned section when on 'all' or 'pinned' filter
  const showPinned = activeFilter === 'all' || activeFilter === 'pinned';

  // Regular threads: exclude pinned, filter by tag
  const regularThreads = threads.filter((t) => {
    if (t.type === 'official' || t.pinned) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pinned') return false;
    return t.tags.includes(activeFilter);
  });

  // Group regular threads by date label, preserving order (newest first)
  const groupOrder: string[] = [];
  const grouped: Record<string, ForumThread[]> = {};
  for (const t of regularThreads) {
    const label = dateGroupLabel(t.createdAt);
    if (!grouped[label]) { grouped[label] = []; groupOrder.push(label); }
    grouped[label].push(t);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.pageTitle}>Community</Text>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterBarWrap}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {threads.length === 0 && (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No posts yet. Create the first thread!</Text>
            </View>
          )}

          {/* Pinned / Official notices — only shown on 'all' or 'pinned' filter */}
          {showPinned && pinnedThreads.length > 0 && (
            <View>
              <Text style={styles.groupHeader}>📌 Pinned</Text>
              {pinnedThreads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  currentUser={user ?? null}
                  onPress={() => router.push(`/forum/${thread.id}` as any)}
                />
              ))}
            </View>
          )}

          {/* Filtered threads grouped by date */}
          {regularThreads.length === 0 && activeFilter !== 'all' && activeFilter !== 'pinned' ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No posts in this category yet.</Text>
            </View>
          ) : activeFilter !== 'pinned' ? (
            groupOrder.map((group) => (
              <View key={group}>
                <Text style={styles.groupHeader}>{group}</Text>
                {grouped[group].map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    currentUser={user ?? null}
                    onPress={() => router.push(`/forum/${thread.id}` as any)}
                  />
                ))}
              </View>
            ))
          ) : null}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/forum/create' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  pageTitle: { fontSize: 26, fontWeight: '800', color: Colors.primary, textAlign: 'center', paddingTop: 12, paddingBottom: 10, letterSpacing: -0.5 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
  groupHeader: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 10, marginBottom: 10 },

  // Filter bar
  filterBarWrap: { flexGrow: 0, flexShrink: 0 },
  filterBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },

  // Card
  card: { backgroundColor: '#FDFAF7', borderRadius: 10, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardOfficial: { borderColor: OFFICIAL_STYLE.border, borderWidth: 1.5, backgroundColor: OFFICIAL_STYLE.bg },
  cardHeader: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  cardHeaderOfficial: { backgroundColor: OFFICIAL_STYLE.bg, borderBottomWidth: 1, borderBottomColor: OFFICIAL_STYLE.border },
  officialHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinnedLabel: { fontSize: 11, fontWeight: '700', color: OFFICIAL_STYLE.tagColor, letterSpacing: 0.8 },
  cardHeaderType: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  cardHeaderDistance: { fontSize: 12, fontWeight: '500', color: '#FFFFFF', opacity: 0.92 },
  cardBody: { padding: 14, paddingBottom: 10 },
  officialTagPill: { alignSelf: 'flex-start', backgroundColor: OFFICIAL_STYLE.tagBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  officialTagText: { fontSize: 11, fontWeight: '700', color: OFFICIAL_STYLE.tagColor, letterSpacing: 0.5 },
  threadTitle: { fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 25, marginBottom: 12, letterSpacing: -0.3 },
  threadTitleRegular: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 21, marginBottom: 8, letterSpacing: -0.2 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  authorDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  fireBody: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 12 },
  fireBodyOfficial: { fontSize: 14, color: '#374151', lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  tagText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // Replying-to
  replyingToBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF7ED', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  replyingToText: { fontSize: 12, color: '#92400E' },

  // Comment input
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', marginHorizontal: 14, marginVertical: 10, borderRadius: 24, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 8 : 6 },
  commentInput: { flex: 1, fontSize: 13, color: '#374151', padding: 0 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chevronBtn: { padding: 2 },

  // Comments
  commentsSection: { borderTopWidth: 1, borderTopColor: '#F0EBE3', paddingBottom: 6 },
  commentUsername: { fontSize: 12, fontWeight: '600', color: '#111827' },
  commentDot: { fontSize: 12, color: '#9CA3AF' },
  commentTime: { fontSize: 11, color: '#9CA3AF' },
  commentText: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 4 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  replyBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  commentDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 14 },
  noComments: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 14 },

  // FAB
  fabContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 16 : 12, right: 16, alignItems: 'flex-end' },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
});