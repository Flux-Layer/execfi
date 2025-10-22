import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { createSeededRng } from "@/lib/utils/prng";

const prisma = new PrismaClient();

/**
 * Generate deterministic seed from date
 */
export function generateWeekSeed(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `SUNDAY_QUEST_${year}_${month}_${day}`;
}

/**
 * Get current Sunday (00:00 UTC)
 */
export function getCurrentSunday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday, etc.
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday;
}

/**
 * Check if today is Sunday
 */
export function isSunday(): boolean {
  return new Date().getUTCDay() === 0;
}

/**
 * Weighted random sampling without replacement
 */
function weightedRandomSample<T>(
  items: T[],
  count: number,
  rng: () => number,
  weights: number[]
): T[] {
  const selected: T[] = [];
  const remaining = [...items];
  const remainingWeights = [...weights];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remainingWeights.reduce((sum, w) => sum + w, 0);
    let random = rng() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remainingWeights[j];
      if (random <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1);
        remainingWeights.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

/**
 * Generate weekly quest rotation
 */
export async function generateWeeklyQuests(
  weekStartDate: Date
): Promise<number[]> {
  console.log(`Generating quests for ${weekStartDate.toISOString()}`);

  // Generate seed
  const seed = generateWeekSeed(weekStartDate);
  const rng = createSeededRng(seed);

  // Calculate week number to determine slot allocation
  const weekNumber = Math.floor(
    (weekStartDate.getTime() - new Date(weekStartDate.getFullYear(), 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );
  const isEpicWeek = weekNumber % 2 === 0;

  const questSlots = {
    EASY: 2,
    MEDIUM: 2,
    HARD: isEpicWeek ? 0 : 1,
    EPIC: isEpicWeek ? 1 : 0,
  };

  // Fetch all active quest templates
  const templates = await prisma.questTemplate.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  // Group by difficulty
  const byDifficulty = {
    EASY: templates.filter((t) => t.difficulty === "EASY"),
    MEDIUM: templates.filter((t) => t.difficulty === "MEDIUM"),
    HARD: templates.filter((t) => t.difficulty === "HARD"),
    EPIC: templates.filter((t) => t.difficulty === "EPIC"),
  };

  // Get last week's quests to avoid repeats
  const lastWeek = addDays(weekStartDate, -7);
  const previousRotation = await prisma.weeklyQuestRotation.findUnique({
    where: { weekStartDate: lastWeek },
  });
  const excludeIds = (previousRotation?.questSlots as number[]) || [];

  // Select quests
  const selectedQuests: number[] = [];

  for (const [difficulty, count] of Object.entries(questSlots)) {
    if (count === 0) continue;

    const candidates = byDifficulty[difficulty as keyof typeof byDifficulty].filter(
      (q) => !excludeIds.includes(q.id)
    );

    if (candidates.length < count) {
      console.warn(`Not enough ${difficulty} quests available without repeats`);
      // If not enough, allow repeats
      const allCandidates =
        byDifficulty[difficulty as keyof typeof byDifficulty];
      const weights = allCandidates.map(() => 1.0);
      const selected = weightedRandomSample(allCandidates, count, rng, weights);
      selectedQuests.push(...selected.map((q) => q.id));
    } else {
      const weights = candidates.map(() => 1.0);
      const selected = weightedRandomSample(candidates, count, rng, weights);
      selectedQuests.push(...selected.map((q) => q.id));
    }
  }

  return selectedQuests;
}

/**
 * Create or get current rotation
 */
export async function ensureCurrentRotation() {
  const thisSunday = getCurrentSunday();
  const nextMonday = addDays(thisSunday, 1);

  // Check if rotation exists
  const existing = await prisma.weeklyQuestRotation.findUnique({
    where: { weekStartDate: thisSunday },
  });

  if (existing) {
    return existing;
  }

  // Generate new rotation
  const questIds = await generateWeeklyQuests(thisSunday);
  const seed = generateWeekSeed(thisSunday);

  const rotation = await prisma.weeklyQuestRotation.create({
    data: {
      weekStartDate: thisSunday,
      weekEndDate: nextMonday,
      questSlots: questIds,
      seed,
      isActive: true,
    },
  });

  console.log(`Created rotation for ${thisSunday.toISOString()}`);
  console.log(`Quest IDs: ${questIds.join(", ")}`);

  return rotation;
}
