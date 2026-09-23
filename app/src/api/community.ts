import type {
  CommentDTO,
  CreatePostInput,
  FeedResponseDTO,
  LikeResultDTO,
  PostDetailDTO,
  PostDTO,
} from '@localbite/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api } from './client';

export const communityKeys = {
  all: ['community'] as const,
  feed: () => [...communityKeys.all, 'feed'] as const,
  post: (id: string) => [...communityKeys.all, 'post', id] as const,
};

const PAGE_SIZE = 20;

export function useCommunityFeed() {
  return useInfiniteQuery({
    queryKey: communityKeys.feed(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api<FeedResponseDTO>('/community/posts', { signal, query: { cursor: pageParam, limit: PAGE_SIZE } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: communityKeys.post(id),
    queryFn: ({ signal }) => api<PostDetailDTO>(`/community/posts/${encodeURIComponent(id)}`, { signal }),
    staleTime: 15_000,
  });
}

/** Akıştaki ve detaydaki aynı gönderiyi birlikte günceller */
function usePatchPost() {
  const queryClient = useQueryClient();
  return (id: string, patch: (p: PostDTO) => Partial<PostDTO>) => {
    queryClient.setQueryData<PostDetailDTO>(communityKeys.post(id), (old) => old && { ...old, ...patch(old) });
    queryClient.setQueryData<InfiniteData<FeedResponseDTO>>(communityKeys.feed(), (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)),
        })),
      },
    );
  };
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostInput) => api<PostDTO>('/community/posts', { method: 'POST', body }),
    onSuccess: (post) => {
      // Yeni gönderi en üstte görünsün; sonra sunucudan tazele
      queryClient.setQueryData<InfiniteData<FeedResponseDTO>>(communityKeys.feed(), (old) =>
        old && {
          ...old,
          pages: old.pages.map((page, i) => (i === 0 ? { ...page, items: [post, ...page.items] } : page)),
        },
      );
      queryClient.invalidateQueries({ queryKey: communityKeys.feed() });
    },
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const patchPost = usePatchPost();
  return useMutation({
    mutationFn: (content: string) =>
      api<CommentDTO>(`/community/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { content } }),
    onSuccess: (comment) => {
      queryClient.setQueryData<PostDetailDTO>(communityKeys.post(postId), (old) =>
        old && { ...old, comments: [...old.comments, comment] },
      );
      patchPost(postId, (p) => ({ commentCount: p.commentCount + 1 }));
    },
  });
}

/** "Katılıyorum": anında (iyimser) güncellenir, hata olursa geri alınır */
export function useToggleLike() {
  const patchPost = usePatchPost();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      api<LikeResultDTO>(`/community/posts/${encodeURIComponent(id)}/like`, { method: liked ? 'PUT' : 'DELETE' }),
    onMutate: ({ id, liked }) => {
      patchPost(id, (p) =>
        p.likedByMe === liked ? {} : { likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) },
      );
    },
    onSuccess: (res, { id }) => patchPost(id, () => ({ likedByMe: res.liked, likeCount: res.likeCount })),
    onError: (_err, { id, liked }) =>
      patchPost(id, (p) => ({ likedByMe: !liked, likeCount: p.likeCount + (liked ? -1 : 1) })),
  });
}
