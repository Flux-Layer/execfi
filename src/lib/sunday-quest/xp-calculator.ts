import { QuestTemplate } from "@prisma/client";

interface CompletionData {
  completionTime?: number; // minutes
  previousCompletions?: number;
  dependencyQuests?: number[];
}

/**
 * Calculate final XP reward for quest completion
 */
export function calculateQuestXP(
  quest: QuestTemplate,
  completionData: CompletionData = {}
): number {
  let finalXP = quest.baseXpReward;

  // 1. Difficulty multiplier
  const difficultyMultipliers = {
    EASY: 1.0,
    MEDIUM: 1.5,
    HARD: 2.0,
    EPIC: 3.0,
  };
  finalXP *= difficultyMultipliers[quest.difficulty];

  // 2. Quest bonus multiplier
  finalXP *= quest.bonusMultiplier;

  // 3. Sunday bonus (20% extra if completed on Sunday)
  const now = new Date();
  if (now.getUTCDay() === 0) {
    finalXP *= 1.2;
  }

  // 4. First-time completion bonus (50% extra)
  if (
    !completionData.previousCompletions ||
    completionData.previousCompletions === 0
  ) {
    finalXP *= 1.5;
  }

  // 5. Speed bonus (30% extra if completed in <25% of estimated time)
  if (completionData.completionTime && quest.estimatedTime) {
    if (completionData.completionTime <= quest.estimatedTime * 0.25) {
      finalXP *= 1.3;
    }
  }

  // 6. Combo quest multiplier
  if (quest.questType === "COMBO" && completionData.dependencyQuests) {
    const multiplier = 1 + completionData.dependencyQuests.length * 0.2;
    finalXP *= multiplier;
  }

  return Math.floor(finalXP);
}
