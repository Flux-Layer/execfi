/**
 * Onboarding system type definitions
 */

export type OnboardingCategory = 'app' | 'terminal' | 'game' | 'features' | 'completion';

export type OnboardingComponentType = 'modal' | 'tooltip' | 'spotlight' | 'tour';

export type OnboardingActionType = 'click' | 'navigate' | 'input' | 'wait';

export interface OnboardingAction {
  type: OnboardingActionType;
  element?: string;
  value?: string;
}

export interface OnboardingStep {
  id: string;
  category: OnboardingCategory;
  title: string;
  description: string;
  order: number;
  skippable: boolean;
  component?: OnboardingComponentType;
  target?: string; // DOM selector for spotlight/tooltip
  action?: OnboardingAction;
  video?: string; // Optional video URL
  image?: string; // Optional image URL
}

export interface OnboardingState {
  onboarded: boolean;
  completed: boolean;
  skipped: boolean;
  currentStep: string | null;
  completedSteps: string[];
  progress: number; // 0-100
  category?: OnboardingCategory;
  totalSteps: number;
}

export interface DeviceOnboardingRecord {
  id: string;
  fingerprint: string;
  onboardedAt?: Date;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  userAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface OnboardingProgressRecord {
  id: number;
  deviceId: string;
  stepId: string;
  completed: boolean;
  completedAt?: Date;
  data?: any;
  createdAt: Date;
  updatedAt: Date;
}
