<script lang="ts">
	import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { RangeCalendar } from "$lib/components/ui/range-calendar";
    import { today, getLocalTimeZone } from "@internationalized/date";
    import type { DateRange } from "bits-ui";

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
        const res = await fetch(`/api/school/search/${name}`)
        schools = (await res.json()).schoolInfo[1].row
    }

    let meals = $state<any[]>([])

    const mealOrder: Record<string, number> = {
        "조식": 1,
        "중식": 2,
        "석식": 3
    };

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
</script>

<div class="flex gap-4">
    <div>
        <div class="flex gap-2 mb-4">
            <Input bind:value={name} type="text" />
            <Button onclick={search}>검색</Button>
        </div>

        <Select.Root type="single" bind:value={selectedSchool}>
            <Select.Trigger class="w-[180px]">{schoolSelectContent}</Select.Trigger>
            <Select.Content>
                {#each schools as school}
                    <Select.Item value={school.SD_SCHUL_CODE} label={school.SCHUL_NM}>{school.SCHUL_NM}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
        
        <div class="mt-4">
            <RangeCalendar bind:value={dateRange} class="rounded-md border" />
        </div>
    </div>

    <div>
        {#if selectedSchool}
            {#if meals.length > 0}
                <div class="flex flex-col gap-4">
                    {#each meals as meal}
                        <div class="border rounded-md p-4">
                            <div class="font-bold">{meal.MLSV_YMD} - {meal.MMEAL_SC_NM}</div>
                            <div class="mt-2">{@html meal.DDISH_NM.replace(/<br\/>/g, '<br>')}</div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div>급식 정보가 없습니다.</div>
            {/if}
        {/if}
    </div>
</div>