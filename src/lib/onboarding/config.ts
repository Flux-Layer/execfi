/**
 * Onboarding step configuration
 * Defines the complete onboarding flow with 17 steps across 5 categories
 */

import type { OnboardingStep } from './types';

/**
 * Complete onboarding steps configuration
 * Total: 17 steps across 5 categories
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ===================================================================
  // Category: App Introduction (Steps 1-4)
  // ===================================================================
  {
    id: 'welcome',
    category: 'app',
    title: 'Welcome to ExecFi',
    description:
      'ExecFi is your AI-powered crypto operating system. Execute complex DeFi operations using natural language commands, play games, and manage your digital assets - all in one place.',
    order: 1,
    skippable: true,
    component: 'modal',
    image: '/onboarding/welcome.png',
  },
  {
    id: 'desktop-overview',
    category: 'app',
    title: 'Desktop Interface',
    description:
      'Navigate ExecFi just like your computer. Open apps, manage windows, and access everything from the dock at the bottom. This familiar interface makes crypto operations feel natural.',
    order: 2,
    skippable: true,
    component: 'modal',
    image: '/onboarding/desktop.png',
  },
  {
    id: 'dock-intro',
    category: 'app',
    title: 'Dock Navigation',
    description:
      'Your dock provides quick access to all ExecFi apps. Click any icon to open Terminal, Notes, Profile, Settings, and more. Hover over icons to see previews on desktop.',
    order: 3,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="dock"]',
  },
  {
    id: 'window-management',
    category: 'app',
    title: 'Window Management',
    description:
      'Manage app windows easily. Minimize windows to hide them temporarily, maximize for full-screen focus, or close them when done. Drag windows to reposition them on your desktop.',
    order: 4,
    skippable: true,
    component: 'modal',
  },

  // ===================================================================
  // Category: Terminal (Steps 5-9)
  // ===================================================================
  {
    id: 'terminal-intro',
    category: 'terminal',
    title: 'Terminal Introduction',
    description:
      'The Terminal is your AI-powered command center. No complex commands needed - just type what you want to do in plain English, and ExecFi will execute it.',
    order: 5,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="dock-terminal"]',
  },
  {
    id: 'terminal-commands',
    category: 'terminal',
    title: 'Natural Language Commands',
    description:
      'Try commands like "/balances", "Swap 10 USDC to ETH on BASE", or "Send 0.1 ETH on BASE to alice.eth". ExecFi understands what you mean and executes it safely.',
    order: 6,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="terminal-input"]',
  },
  {
    id: 'terminal-balance',
    category: 'terminal',
    title: 'Check Balance',
    description:
      'Want to see your portfolio? Just type "/balance" or "/balances". ExecFi fetches your assets across all supported chains and displays them beautifully.',
    order: 7,
    skippable: true,
    component: 'tooltip',
    target: '[data-onboarding-id="terminal-input"]',
  },
  {
    id: 'terminal-swap',
    category: 'terminal',
    title: 'Swap Tokens',
    description:
      'Swapping is easy: "Swap 100 USDC to ETH on BASE" or "Swap 1 DAI to WBTC on BASE". ExecFi finds the best rates across DEXes and executes your trade.',
    order: 8,
    skippable: true,
    component: 'tooltip',
    target: '[data-onboarding-id="terminal-input"]',
  },
  {
    id: 'terminal-help',
    category: 'terminal',
    title: 'Command Help',
    description:
      'Not sure what to do? Type "/help" to see available commands. ExecFi provides examples and guides you through any operation.',
    order: 9,
    skippable: true,
    component: 'modal',
  },

  // ===================================================================
  // Category: Features (Steps 10-13)
  // ===================================================================
  {
    id: 'notes-intro',
    category: 'features',
    title: 'Notes App',
    description:
      'Keep track of your ideas, wallet addresses, and important information. Your notes are stored locally and sync across sessions.',
    order: 10,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="dock-notes"]',
  },
  {
    id: 'profile-intro',
    category: 'features',
    title: 'Profile Settings',
    description:
      'Customize your ExecFi experience. Manage your wallets, adjust preferences, and view your transaction history - all in one place.',
    order: 11,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="dock-profile"]',
  },
  {
    id: 'wallet-intro',
    category: 'features',
    title: 'Wallet Connection',
    description:
      'Your wallet will be automatically set up if you have logged in with privy (type "/login" command in the terminal).',
    order: 12,
    skippable: true,
    component: 'modal',
  },
  {
    id: 'smart-account',
    category: 'features',
    title: 'Smart Account Benefits',
    description:
      'With Base Smart Accounts, you get gas sponsorship, batch transactions, and enhanced security. Execute multiple operations in one click and save on fees.',
    order: 13,
    skippable: true,
    component: 'modal',
  },

  // ===================================================================
  // Category: Game (Steps 14-16)
  // ===================================================================
  {
    id: 'game-overview',
    category: 'game',
    title: 'Degenshoot Game',
    description:
      'Ready to have some fun? Degenshoot is a provably fair wagering game where you navigate through bomb-filled rows. The higher you go, the bigger your multiplier!',
    order: 14,
    skippable: true,
    component: 'modal',
    image: '/onboarding/game.png',
  },
  {
    id: 'game-shortcut',
    category: 'game',
    title: 'Desktop Shortcut',
    description:
      'Quick access to Degenshoot! Click the game icon on your desktop to launch immediately. No need to navigate through menus.',
    order: 15,
    skippable: true,
    component: 'spotlight',
    target: '[data-onboarding-id="desktop-game-shortcut"]',
  },
  {
    id: 'game-demo',
    category: 'game',
    title: 'Try Demo Game',
    description:
      'Want to practice first? Launch Degenshoot and try a demo round with virtual tokens. Get a feel for the mechanics before wagering real crypto.',
    order: 16,
    skippable: true,
    component: 'modal',
  },

  // ===================================================================
  // Category: Completion (Step 17)
  // ===================================================================
  {
    id: 'complete',
    category: 'completion',
    title: "You're All Set!",
    description:
      "Congratulations! You're ready to use ExecFi. Connect your wallet to start executing DeFi operations, or continue exploring in demo mode. Need help? Click the ? icon anytime.",
    order: 17,
    skippable: false,
    component: 'modal',
  },
];

/**
 * Get onboarding step by ID
 */
export function getStepById(stepId: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
}

/**
 * Get next step after current step
 */
export function getNextStep(currentStepId: string): OnboardingStep | null {
  const currentStep = getStepById(currentStepId);
  if (!currentStep) return ONBOARDING_STEPS[0];

  const nextStep = ONBOARDING_STEPS.find((step) => step.order === currentStep.order + 1);
  return nextStep || null;
}

/**
 * Get previous step before current step
 */
export function getPreviousStep(currentStepId: string): OnboardingStep | null {
  const currentStep = getStepById(currentStepId);
  if (!currentStep) return null;

  const prevStep = ONBOARDING_STEPS.find((step) => step.order === currentStep.order - 1);
  return prevStep || null;
}

/**
 * Get all steps in a specific category
 */
export function getStepsByCategory(category: string): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => step.category === category);
}

/**
 * Get first step
 */
export function getFirstStep(): OnboardingStep {
  return ONBOARDING_STEPS[0];
}

/**
 * Get last step
 */
export function getLastStep(): OnboardingStep {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
}

/**
 * Check if step is the last step
 */
export function isLastStep(stepId: string): boolean {
  const step = getStepById(stepId);
  if (!step) return false;
  return step.order === ONBOARDING_STEPS.length;
}

/**
 * Get total number of steps
 */
export function getTotalSteps(): number {
  return ONBOARDING_STEPS.length;
}
