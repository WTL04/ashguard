import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebaseConfig';
import { Colors } from '@/constants/colors';
import {
  ForumThread,
  ForumComment,
  TYPE_LABEL,
  OFFICIAL_STYLE,
  subscribeToComments,
  postComment,
  formatPostDate,
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
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const isOfficialUser = comment.avatarColor === '#B45309';
  const avatarSize = depth === 0 ? 40 : 30;

  return (
    <View style={[styles.commentWrap, isOfficialUser && styles.commentWrapOfficial, { paddingLeft: depth * INDENT + 16 }]}>
      {isOfficialUser && (
        <View style={styles.officialCommentBadge}>
          <Ionicons name="shield-checkmark" size={11} color={OFFICIAL_STYLE.tagColor} />
          <Text style={styles.officialCommentBadgeText}>OFFICIAL</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Avatar username={comment.authorUsername} color={comment.avatarColor} size={avatarSize} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
            <Text style={styles.commentUsername}>{comment.authorUsername}</Text>
            <Text style={styles.commentDot}> · </Text>
            <Text style={styles.commentTime}>{comment.timeAgo}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => { setLiked((l) => !l); setLikeCount((n) => liked ? n - 1 : n + 1); }}
              activeOpacity={0.7}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? '#EF4444' : '#9CA3AF'} />
              {likeCount > 0 && <Text style={[styles.likeCount, liked && { color: '#EF4444' }]}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.replyBtn} onPress={() => onReply(comment.id, comment.authorUsername)} activeOpacity={0.7}>
              <Ionicons name="chatbubble-outline" size={12} color={Colors.primary} />
              <Text style={styles.replyBtnText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [user] = useAuthState(auth);

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Fetch thread doc once
  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'threads', id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const ts = data.createdAt ?? null;
        setThread({
          id: snap.id,
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
        });
      }
      setLoadingThread(false);
    });
  }, [id]);

  // Live comments subscription
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToComments(id, setComments);
    return unsub;
  }, [id]);

  const tree = buildTree(comments);
  const isOfficial = thread?.type === 'official';

  const handleReply = (cId: string, username: string) => {
    setReplyingToId(cId);
    setReplyingToName(username);
    setCommentText(`@${username} `);
  };

  const handleCancelReply = () => {
    setReplyingToId(null);
    setReplyingToName(null);
    setCommentText('');
  };

  const handlePost = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || posting || !id) return;
    setPosting(true);
    try {
      await postComment({
        threadId: id,
        parentId: replyingToId,
        authorId: user?.uid ?? 'anonymous',
        authorUsername: user?.displayName ?? user?.email ?? 'Anonymous',
        avatarColor: Colors.primary,
        text: trimmed,
      });
      setCommentText('');
      setReplyingToId(null);
      setReplyingToName(null);
    } finally {
      setPosting(false);
    }
  };

  if (loadingThread) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!thread) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#D1D5DB" />
          <Text style={styles.notFoundText}>Thread not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Community</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Thread card */}
          <View style={[styles.card, isOfficial && styles.cardOfficial]}>
            <View style={[styles.cardHeader, isOfficial && styles.cardHeaderOfficial]}>
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
            </View>
            <View style={styles.cardBody}>
              {isOfficial && (
                <View style={styles.officialTagPill}>
                  <Text style={styles.officialTagText}>OFFICIAL</Text>
                </View>
              )}
              {isOfficial && thread.title && (
                <Text style={styles.threadTitle}>{thread.title}</Text>
              )}
              {!isOfficial && thread.title && (
                <Text style={styles.threadTitleRegular}>{thread.title}</Text>
              )}
              <View style={styles.authorRow}>
                <Avatar username={thread.authorUsername} color={isOfficial ? OFFICIAL_STYLE.tagColor : '#6B7280'} size={40} />
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
            </View>
          </View>

          {/* Replies divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{comments.length} {comments.length === 1 ? 'reply' : 'replies'}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Comments */}
          <View style={styles.commentsContainer}>
            {tree.length === 0 ? (
              <Text style={styles.noComments}>No replies yet. Be the first!</Text>
            ) : (
              tree.map(({ comment, depth }, idx) => (
                <View key={comment.id}>
                  <CommentRow comment={comment} depth={depth} onReply={handleReply} />
                  {idx < tree.length - 1 && <View style={styles.commentDivider} />}
                </View>
              ))
            )}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Replying-to banner */}
        {replyingToName && (
          <View style={styles.replyingToBar}>
            <Text style={styles.replyingToText}>
              Replying to <Text style={{ fontWeight: '700' }}>@{replyingToName}</Text>
            </Text>
            <TouchableOpacity onPress={handleCancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Add a reply..."
              placeholderTextColor="#9CA3AF"
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handlePost}
              returnKeyType="send"
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || posting) && { opacity: 0.4 }]}
            onPress={handlePost}
            disabled={!commentText.trim() || posting}
            activeOpacity={0.8}
          >
            {posting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F5F5F5' },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },

  card: { backgroundColor: '#FDFAF7', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardOfficial: { borderColor: OFFICIAL_STYLE.border, borderWidth: 1.5, backgroundColor: OFFICIAL_STYLE.bg },
  cardHeader: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  cardHeaderOfficial: { backgroundColor: OFFICIAL_STYLE.bg, borderBottomWidth: 1, borderBottomColor: OFFICIAL_STYLE.border },
  officialHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinnedLabel: { fontSize: 11, fontWeight: '700', color: OFFICIAL_STYLE.tagColor, letterSpacing: 0.8 },
  cardHeaderType: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  cardHeaderDistance: { fontSize: 12, fontWeight: '500', color: '#FFFFFF', opacity: 0.92 },
  cardBody: { padding: 16 },
  officialTagPill: { alignSelf: 'flex-start', backgroundColor: OFFICIAL_STYLE.tagBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
  officialTagText: { fontSize: 11, fontWeight: '700', color: OFFICIAL_STYLE.tagColor, letterSpacing: 0.5 },
  threadTitle: { fontSize: 20, fontWeight: '700', color: '#111827', lineHeight: 27, marginBottom: 14, letterSpacing: -0.4 },
  threadTitleRegular: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 24, marginBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  authorDate: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  fireBody: { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  fireBodyOfficial: { color: '#374151', lineHeight: 23 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagPill: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  tagText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  commentsContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  commentWrap: { paddingRight: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  commentWrapOfficial: { backgroundColor: '#FFFBEB' },
  officialCommentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, paddingLeft: 16 },
  officialCommentBadgeText: { fontSize: 10, fontWeight: '700', color: OFFICIAL_STYLE.tagColor, letterSpacing: 0.5 },
  commentUsername: { fontSize: 13, fontWeight: '600', color: '#111827' },
  commentDot: { fontSize: 13, color: '#9CA3AF' },
  commentTime: { fontSize: 12, color: '#9CA3AF' },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  commentDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 16 },
  noComments: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },

  replyingToBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  replyingToText: { fontSize: 12, color: '#92400E' },

  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  inputWrap: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  textInput: { fontSize: 14, color: '#374151', padding: 0 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  notFoundText: { fontSize: 16, color: '#9CA3AF' },
  backLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});