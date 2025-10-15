import { prisma } from '@/lib/db/client';
import { TUTORIAL_STEPS } from './config';

export interface OnboardingState {
  onboarded: boolean;
  tutorialCompleted: boolean;
  tutorialSkipped: boolean;
  currentStep: string | null;
  completedSteps: string[];
  progress: number;
}

export async function getOnboardingState(userAddress: string): Promise<OnboardingState> {
  let user = await prisma.user.findUnique({
    where: { address: userAddress.toLowerCase() },
    include: { tutorialProgress: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { address: userAddress.toLowerCase() },
      include: { tutorialProgress: true },
    });
  }

  const completedSteps = user.tutorialProgress.filter(p => p.completed).map(p => p.stepId);
  const progress = Math.round((completedSteps.length / TUTORIAL_STEPS.length) * 100);

  let currentStep: string | null = null;
  if (!user.tutorialCompletedAt && !user.tutorialSkipped) {
    currentStep = TUTORIAL_STEPS.find(s => !completedSteps.includes(s.id))?.id || null;
  }

  return {
    onboarded: !!user.onboardedAt,
    tutorialCompleted: !!user.tutorialCompletedAt,
    tutorialSkipped: user.tutorialSkipped,
    currentStep,
    completedSteps,
    progress,
  };
}

export async function completeStep(userAddress: string, stepId: string): Promise<void> {
  await prisma.tutorialProgress.upsert({
    where: { userAddress_stepId: { userAddress: userAddress.toLowerCase(), stepId } },
    create: { userAddress: userAddress.toLowerCase(), stepId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });

  const step = TUTORIAL_STEPS.find(s => s.id === stepId);
  if (step?.order === 1) {
    await prisma.user.update({
      where: { address: userAddress.toLowerCase() },
      data: { onboardedAt: new Date() },
    });
  }
}

export async function completeTutorial(userAddress: string): Promise<void> {
  await prisma.user.update({
    where: { address: userAddress.toLowerCase() },
    data: { tutorialCompletedAt: new Date(), onboardedAt: new Date() },
  });
}

export async function skipTutorial(userAddress: string): Promise<void> {
  await prisma.user.update({
    where: { address: userAddress.toLowerCase() },
    data: { tutorialSkipped: true, onboardedAt: new Date() },
  });
}
