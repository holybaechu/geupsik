<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Calendar } from "$lib/components/ui/calendar";
    import { CalendarDate, today, getLocalTimeZone, type DateValue } from "@internationalized/date";
    import { Search, CircleAlert, ThumbsUp, MessageSquare } from "@lucide/svelte";
    import type { OptimizedSchool, OptimizedMeal } from "$lib/types";

    let name = $state(page.url.searchParams.get("name") || "")
    let schools = $state<OptimizedSchool[]>([])
    let error = $state<string | null>(null)

    let selectedSchool = $state<string>(page.url.searchParams.get("school") || "")
    const initialOffice = page.url.searchParams.get("office") || "";
    let selectedOfficeCode = $derived(
        (selectedSchool && schools.length > 0) 
            ? schools.find(s => s.schoolCode === selectedSchool)?.officeCode ?? initialOffice
            : initialOffice
    );
    const schoolSelectContent = $derived(
        schools.find((s) => s.schoolCode === selectedSchool)?.schoolName ?? "학교를 선택해주세요"
    );

    let selectedDate = $state<DateValue>((() => {
        const dateParam = page.url.searchParams.get("date");
        if (dateParam) {
            const parsed = new Date(dateParam);
            if (!isNaN(parsed.getTime())) {
                return new CalendarDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
            }
        }
        return today(getLocalTimeZone());
    })());

    $effect(() => {
        const n = name;
        const s = selectedSchool;
        const d = selectedDate;
        const o = selectedOfficeCode;
        
        const timeout = setTimeout(() => {
            const url = new URL(window.location.href);
            if (n) url.searchParams.set('name', n);
            else url.searchParams.delete('name');
            
            if (s) url.searchParams.set('school', s);
            else url.searchParams.delete('school');
            
            if (o) url.searchParams.set('office', o);
            else url.searchParams.delete('office');
            
            if (d) {
                url.searchParams.set('date', `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);
            }
            
            goto(url.toString(), { replaceState: true, keepFocus: true });
        }, 300);

        return () => clearTimeout(timeout);
    });

    onMount(() => {
        if (name && schools.length === 0) {
            search();
        }
    });

    async function search() {
        if (!name.trim()) return;
        error = null;
        try {
            const res = await fetch(`/api/school/search/${encodeURIComponent(name)}`)
            if (!res.ok) throw new Error("학교 검색에 실패했습니다.");
            const data = await res.json();
            if (data.schools) {
                schools = data.schools;
            } else {
                schools = [];
                error = "검색 결과가 없습니다.";
            }
        } catch (e: any) {
            error = e.message || "학교 검색 중 오류가 발생했습니다.";
            schools = [];
        }
    }

    let meals = $state<OptimizedMeal[]>([])

    const mealOrder: Record<string, number> = {
        "조식": 1,
        "중식": 2,
        "석식": 3
    };

    $effect(() => {
        if (selectedSchool && selectedDate && selectedOfficeCode) {
            error = null;
            const dateStr = selectedDate.toString().replace(/-/g, "");
            fetch(`/api/meal/${selectedSchool}?from=${dateStr}&to=${dateStr}&officeCode=${selectedOfficeCode}`)
                .then(async res => {
                    if (!res.ok) throw new Error("급식 정보를 불러오는데 실패했습니다.");
                    return res.json();
                })
                .then(data => {
                    if (data.meals) {
                        meals = data.meals.sort((a: OptimizedMeal, b: OptimizedMeal) => {
                            if (a.date !== b.date) {
                                return a.date.localeCompare(b.date);
                            }
                            const orderA = mealOrder[a.type] || 4;
                            const orderB = mealOrder[b.type] || 4;
                            return orderA - orderB;
                        });
                    } else {
                        meals = []
                        if (data.RESULT && data.RESULT.CODE !== "INFO-200") {
                            error = data.RESULT.MESSAGE;
                        } else if (data.error) {
                            error = data.error;
                        }
                    }
                })
                .catch(e => {
                    meals = [];
                    error = e.message || "급식 정보를 불러오는 중 오류가 발생했습니다.";
                });
        } else {
            meals = []
        }
    })

</script>

<div class="min-h-screen bg-gray-50/50 p-6 md:p-12">
    <div class="mx-auto max-w-5xl">
        <header class="mb-8">
            <h1 class="text-3xl font-extrabold tracking-tight text-gray-900">급식친구</h1>
            <p class="mt-2 text-sm text-gray-500">친구들과 함께 급식을 공유하고 의견을 나눠보세요</p>
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
                                        <Select.Item value={school.schoolCode} label={school.schoolName}>{school.schoolName}</Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        </div>
                    {/if}
                    
                    {#if error}
                        <div class="text-sm text-red-500 font-medium">
                            {error}
                        </div>
                    {/if}
                </div>
                
                <div class="space-y-2 pt-4 border-t border-gray-100">
                    <span class="text-sm font-medium text-gray-700 block">날짜 선택</span>
                    <div class="flex justify-center">
                        <Calendar type="single" bind:value={selectedDate} class="rounded-xl border shadow-xs bg-white" locale="ko-KR" />
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                {#if selectedSchool}
                    {#if meals.length > 0}
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {#each meals as meal}
                                <a href="/meal/{encodeURIComponent(meal.id)}" class="group flex flex-col h-full relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-xs transition-all hover:shadow-md hover:border-blue-200 cursor-pointer">
                                    <div class="absolute top-0 left-0 w-full h-1 bg-linear-to-r 
                                        {meal.type === '조식' ? 'from-orange-300 to-amber-400' : 
                                         meal.type === '중식' ? 'from-blue-400 to-cyan-400' : 
                                         'from-indigo-500 to-purple-500'}">
                                    </div>
                                    <div class="font-bold text-xl mb-4 flex items-center justify-between">
                                        <span class="text-gray-900">{meal.type}</span>
                                        <span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{meal.calories}</span>
                                    </div>
                                    <div class="text-sm leading-relaxed text-gray-700 space-y-2 flex-1">
                                        {#each meal.dishes.split('<br/>') as dish}
                                            <div class="flex items-start gap-2">
                                                <span class="text-gray-300 mt-0.5">•</span>
                                                <span class="flex-1">{dish}</span>
                                            </div>
                                        {/each}
                                    </div>
                                    <div class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                                        <div class="flex items-center gap-1.5">
                                            <ThumbsUp class="w-4 h-4" />
                                            <span>{meal.votes}</span>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <MessageSquare class="w-4 h-4" />
                                            <span>{meal.comments}</span>
                                        </div>
                                    </div>
                                </a>
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