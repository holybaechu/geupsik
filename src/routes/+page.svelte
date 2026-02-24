<script lang="ts">
	import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { RangeCalendar } from "$lib/components/ui/range-calendar";
    import { today, getLocalTimeZone } from "@internationalized/date";
    import type { DateRange } from "bits-ui";
    import { Search, CircleAlert, ThumbsUp, MessageSquare } from "@lucide/svelte";

    let name = $state("")
    let schools = $state<any[]>([])

    let selectedSchool = $state<string>("")
    const schoolSelectContent = $derived(
        schools.find((s) => s.SD_SCHUL_CODE === selectedSchool)?.SCHUL_NM ?? "학교를 선택해주세요"
    );

    let dateRange = $state<DateRange>({
        start: today(getLocalTimeZone()),
        end: today(getLocalTimeZone()).add({ days: 2 })
    });

    async function search() {
        if (!name.trim()) return;
        const res = await fetch(`/api/school/search/${name}`)
        schools = (await res.json()).schoolInfo[1].row
    }

    let meals = $state<any[]>([])
    let groupedMeals = $derived(() => {
        const groups: Record<string, any[]> = {};
        for (const meal of meals) {
            if (!groups[meal.MLSV_YMD]) {
                groups[meal.MLSV_YMD] = [];
            }
            groups[meal.MLSV_YMD].push(meal);
        }
        return groups;
    });

    const mealOrder: Record<string, number> = {
        "조식": 1,
        "중식": 2,
        "석식": 3
    };

    function formatYYMMDD(ymd: string) {
        if (!ymd || ymd.length !== 8) return ymd;
        const year = ymd.substring(2, 4);
        const month = ymd.substring(4, 6);
        const day = ymd.substring(6, 8);
        return `${year}.${month}.${day}`;
    }

    $effect(() => {
        if (selectedSchool && dateRange.start && dateRange.end) {
            const startStr = dateRange.start.toString().replace(/-/g, "");
            const endStr = dateRange.end.toString().replace(/-/g, "");
            fetch(`/api/meal/${selectedSchool}?from=${startStr}&to=${endStr}`)
                .then(res => res.json())
                .then(data => {
                    if (data.mealServiceDietInfo) {
                        const fetchedMeals = data.mealServiceDietInfo[1].row;
                        meals = fetchedMeals.sort((a: any, b: any) => {
                            if (a.MLSV_YMD !== b.MLSV_YMD) {
                                return a.MLSV_YMD.localeCompare(b.MLSV_YMD);
                            }
                            const orderA = mealOrder[a.MMEAL_SC_NM] || 4;
                            const orderB = mealOrder[b.MMEAL_SC_NM] || 4;
                            return orderA - orderB;
                        });
                    } else {
                        meals = []
                    }
                })
        } else {
            meals = []
        }
    })

    function getMealId(meal: any) {
        return `${selectedSchool}-${meal.MLSV_YMD}-${meal.MMEAL_SC_NM}`;
    }

    function getVoteCount(meal: any) {
        if (typeof window === 'undefined') return 0;
        const mealId = getMealId(meal);
        const stored = localStorage.getItem(`votes-${mealId}`);
        return stored ? parseInt(stored, 10) : 0;
    }

    function getCommentCount(meal: any) {
        if (typeof window === 'undefined') return 0;
        const mealId = getMealId(meal);
        const stored = localStorage.getItem(`comments-${mealId}`);
        return stored ? JSON.parse(stored).length : 0;
    }
</script>

<div class="min-h-screen bg-gray-50/50 p-6 md:p-12">
    <div class="mx-auto max-w-5xl">
        <header class="mb-8">
            <h1 class="text-3xl font-extrabold tracking-tight text-gray-900">학교 급식 검색</h1>
            <p class="mt-2 text-sm text-gray-500">학교를 검색하고 날짜를 선택하여 급식 식단을 확인하세요.</p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-8 items-start">
            <div class="flex flex-col gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label for="school-search" class="text-sm font-medium text-gray-700">학교 검색</label>
                        <div class="flex gap-2">
                            <Input id="school-search" bind:value={name} type="text" placeholder="학교 이름 입력" onkeydown={(e) => e.key === 'Enter' && search()} />
                            <Button onclick={search} variant="default">검색</Button>
                        </div>
                    </div>

                    {#if schools.length > 0}
                        <div class="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label for="school-select" class="text-sm font-medium text-gray-700">학교 선택</label>
                            <Select.Root type="single" bind:value={selectedSchool}>
                                <Select.Trigger id="school-select" class="w-full bg-white">
                                    {schoolSelectContent}
                                </Select.Trigger>
                                <Select.Content>
                                    {#each schools as school}
                                        <Select.Item value={school.SD_SCHUL_CODE} label={school.SCHUL_NM}>{school.SCHUL_NM}</Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        </div>
                    {/if}
                </div>
                
                <div class="space-y-2 pt-4 border-t border-gray-100">
                    <span class="text-sm font-medium text-gray-700 block">기간 선택</span>
                    <div class="flex justify-center">
                        <RangeCalendar bind:value={dateRange} class="rounded-xl border shadow-xs bg-white" />
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                {#if selectedSchool}
                    {#if meals.length > 0}
                        <div class="space-y-8">
                            {#each Object.entries(groupedMeals()) as [date, dayMeals]}
                                <div class="space-y-4">
                                    <h2 class="text-xl font-bold flex items-center gap-2 text-gray-900 border-b pb-2">
                                        <span class="bg-blue-100 text-blue-800 text-sm px-2.5 py-1 rounded-md font-semibold tracking-wide">
                                            {formatYYMMDD(date)}
                                        </span>
                                    </h2>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {#each dayMeals as meal}
                                            <a href="/meal/{encodeURIComponent(getMealId(meal))}" class="group flex flex-col h-full relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-xs transition-all hover:shadow-md hover:border-blue-200 cursor-pointer">
                                                <div class="absolute top-0 left-0 w-full h-1 bg-linear-to-r 
                                                    {meal.MMEAL_SC_NM === '조식' ? 'from-orange-300 to-amber-400' : 
                                                     meal.MMEAL_SC_NM === '중식' ? 'from-blue-400 to-cyan-400' : 
                                                     'from-indigo-500 to-purple-500'}">
                                                </div>
                                                <div class="font-bold text-xl mb-4 flex items-center justify-between">
                                                    <span class="text-gray-900">{meal.MMEAL_SC_NM}</span>
                                                    <span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{meal.CAL_INFO}</span>
                                                </div>
                                                <div class="text-sm leading-relaxed text-gray-700 space-y-2 flex-1">
                                                    {#each meal.DDISH_NM.split('<br/>') as dish}
                                                        <div class="flex items-start gap-2">
                                                            <span class="text-gray-300 mt-0.5">•</span>
                                                            <span class="flex-1">{dish}</span>
                                                        </div>
                                                    {/each}
                                                </div>
                                                <div class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                                                    <div class="flex items-center gap-1.5">
                                                        <ThumbsUp class="w-4 h-4" />
                                                        <span>{getVoteCount(meal)}</span>
                                                    </div>
                                                    <div class="flex items-center gap-1.5">
                                                        <MessageSquare class="w-4 h-4" />
                                                        <span>{getCommentCount(meal)}</span>
                                                    </div>
                                                </div>
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="flex flex-col items-center justify-center h-full py-20 text-center text-gray-500">
                            <div class="bg-gray-100 p-4 rounded-full mb-4">
                                <CircleAlert class="w-8 h-8 text-gray-400" />
                            </div>
                            <p class="text-lg font-medium text-gray-900 mb-1">선택한 기간의 급식 정보가 없습니다</p>
                            <p class="text-sm">다른 날짜를 선택하거나 다른 학교를 검색해보세요.</p>
                        </div>
                    {/if}
                {:else}
                    <div class="flex flex-col items-center justify-center h-full py-20 text-center text-gray-500">
                        <div class="bg-blue-50 p-4 rounded-full mb-4 text-blue-500">
                            <Search class="w-8 h-8" />
                        </div>
                        <p class="text-lg font-medium text-gray-900 mb-1">학교를 선택해주세요</p>
                        <p class="text-sm">검색창에 학교 이름을 입력하고 검색 버튼을 눌러주세요.</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>