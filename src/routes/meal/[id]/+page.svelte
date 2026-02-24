<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { ArrowLeft, ThumbsUp, MessageSquare, Send } from "@lucide/svelte";
    import { goto } from '$app/navigation';

    const params = $derived($page.params as { id: string });
    const mealId = $derived(decodeURIComponent(params.id));
    const parts = $derived(mealId.split('-'));
    const schoolCode = $derived(parts[0] || '');
    const date = $derived(parts[1] || '');
    const mealType = $derived(parts[2] || '');

    function formatDate(ymd: string) {
        if (!ymd || ymd.length !== 8) return ymd;
        const year = ymd.substring(0, 4);
        const month = ymd.substring(4, 6);
        const day = ymd.substring(6, 8);
        return `${year}.${month}.${day}`;
    }

    const mealTypeColors: Record<string, string> = {
        "조식": "from-orange-300 to-amber-400",
        "중식": "from-blue-400 to-cyan-400",
        "석식": "from-indigo-500 to-purple-500"
    };

    let meal = $state<any>(null);
    let votes = $state(0);
    let hasVoted = $state(false);
    let comments = $state<{id: number, text: string, created_at: string}[]>([]);
    let newComment = $state("");
    let loading = $state(true);
    let fingerprint = $state("");

    function getFingerprint() {
        let fp = localStorage.getItem('userFingerprint');
        if (!fp) {
            fp = crypto.randomUUID();
            localStorage.setItem('userFingerprint', fp);
        }
        return fp;
    }

    async function loadVotes() {
        try {
            const res = await fetch(`/api/votes/${encodeURIComponent(mealId)}`);
            if (res.ok) {
                const data = await res.json();
                votes = data.count;
            }
        } catch (e) {
            console.error('Failed to load votes:', e);
        }
    }

    async function loadComments() {
        try {
            const res = await fetch(`/api/comments/${encodeURIComponent(mealId)}`);
            if (res.ok) {
                const data = await res.json();
                comments = data.comments;
            }
        } catch (e) {
            console.error('Failed to load comments:', e);
        }
    }

    async function checkIfVoted() {
        const votedMeals = JSON.parse(localStorage.getItem('votedMeals') || '[]');
        hasVoted = votedMeals.includes(mealId);
    }

    $effect(() => {
        if (schoolCode && date) {
            fingerprint = getFingerprint();
            checkIfVoted();

            fetch(`/api/meal/${schoolCode}?from=${date}&to=${date}`)
                .then(res => res.json())
                .then(data => {
                    if (data.mealServiceDietInfo) {
                        const fetchedMeals = data.mealServiceDietInfo[1].row;
                        meal = fetchedMeals.find((m: any) => m.MMEAL_SC_NM === mealType);
                    }
                    loading = false;
                })
                .catch(() => {
                    loading = false;
                });

            loadVotes();
            loadComments();
        }
    });

    async function handleVote() {
        if (hasVoted) return;
        try {
            const res = await fetch(`/api/votes/${encodeURIComponent(mealId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fingerprint })
            });
            if (res.ok) {
                const data = await res.json();
                votes = data.count;
                hasVoted = true;
                const votedMeals = JSON.parse(localStorage.getItem('votedMeals') || '[]');
                votedMeals.push(mealId);
                localStorage.setItem('votedMeals', JSON.stringify(votedMeals));
            }
        } catch (e) {
            console.error('Failed to vote:', e);
        }
    }

    async function handleAddComment() {
        if (!newComment.trim()) return;
        try {
            const res = await fetch(`/api/comments/${encodeURIComponent(mealId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newComment.trim() })
            });
            if (res.ok) {
                const data = await res.json();
                comments = [data.comment, ...comments];
                newComment = "";
            }
        } catch (e) {
            console.error('Failed to add comment:', e);
        }
    }

    function formatTimestamp(timestamp: string) {
        return new Date(timestamp).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<div class="min-h-screen bg-gray-50/50 p-6 md:p-12">
    <div class="mx-auto max-w-3xl">
        <Button variant="ghost" class="mb-6 -ml-3" onclick={() => goto('/')}>
            <ArrowLeft class="w-4 h-4 mr-2" />
            돌아가기
        </Button>

        {#if loading}
            <div class="flex items-center justify-center py-20">
                <div class="text-gray-500">로딩 중...</div>
            </div>
        {:else if meal}
            <div class="space-y-6">
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="h-2 bg-linear-to-r {mealTypeColors[meal.MMEAL_SC_NM] || 'from-gray-400 to-gray-500'}"></div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h1 class="text-2xl font-bold text-gray-900">{meal.MMEAL_SC_NM}</h1>
                                <span class="text-sm text-gray-500">{meal.SCHUL_NM}</span>
                            </div>
                            <span class="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{formatDate(date)}</span>
                        </div>
                        <div class="text-sm text-gray-500 mb-6">{meal.CAL_INFO}</div>

                        <div class="space-y-2 mb-6">
                            {#each meal.DDISH_NM.split('<br/>') as dish}
                                <div class="flex items-start gap-2 text-gray-700">
                                    <span class="text-gray-300 mt-0.5">•</span>
                                    <span class="flex-1">{dish}</span>
                                </div>
                            {/each}
                        </div>

                        <!-- Vote Button -->
                        <div class="flex items-center gap-4 pt-4 border-t border-gray-100">
                            <Button
                                variant={hasVoted ? "secondary" : "default"}
                                class="flex items-center gap-2"
                                onclick={handleVote}
                                disabled={hasVoted}
                            >
                                <ThumbsUp class="w-4 h-4 {hasVoted ? 'fill-current' : ''}" />
                                <span>{hasVoted ? '추천함' : '추천하기'}</span>
                                <span class="ml-1 text-xs opacity-70">({votes})</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div class="flex items-center gap-2 mb-6">
                        <MessageSquare class="w-5 h-5 text-gray-600" />
                        <h2 class="text-lg font-semibold text-gray-900">댓글</h2>
                        <span class="text-sm text-gray-500">({comments.length})</span>
                    </div>

                    <div class="flex gap-3 mb-6">
                        <Input
                            bind:value={newComment}
                            placeholder="댓글을 입력하세요..."
                            onkeydown={(e) => e.key === 'Enter' && handleAddComment()}
                            class="flex-1"
                        />
                        <Button onclick={handleAddComment} disabled={!newComment.trim()}>
                            <Send class="w-4 h-4 mr-2" />
                            작성
                        </Button>
                    </div>

                    <div class="space-y-4">
                        {#if comments.length === 0}
                            <div class="text-center py-8 text-gray-500">
                                아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
                            </div>
                        {:else}
                            {#each comments as comment}
                                <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <div class="text-sm font-bold text-black">익명</div>
                                    <div class="text-sm text-gray-700">{comment.text}</div>
                                    <div class="text-xs text-gray-400">{formatTimestamp(comment.created_at)}</div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>
        {:else}
            <div class="text-center py-20">
                <div class="text-gray-500 mb-4">급식 정보를 찾을 수 없습니다.</div>
                <Button onclick={() => goto('/')}>홈으로 돌아가기</Button>
            </div>
        {/if}
    </div>
</div>
