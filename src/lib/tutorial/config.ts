export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  order: number;
  skippable: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { 
    id: 'welcome', 
    title: 'Welcome to ExecFi Degenshoot', 
    description: 'Learn how to play and maximize your winnings in this exciting bomb-avoidance game', 
    order: 1, 
    skippable: true 
  },
  { 
    id: 'objective', 
    title: 'Game Objective', 
    description: 'Navigate through rows by selecting tiles while avoiding hidden bombs. Each successful row increases your multiplier!', 
    order: 2, 
    skippable: true 
  },
  { 
    id: 'betting', 
    title: 'Placing Your Bet', 
    description: 'Choose your wager amount and configure the number of bombs per row. More bombs = higher risk but bigger rewards!', 
    order: 3, 
    skippable: false 
  },
  { 
    id: 'tile-selection', 
    title: 'Selecting Tiles', 
    description: 'Click on a tile to reveal it. If it\'s safe, you advance to the next row with an increased multiplier. Hit a bomb and the game ends!', 
    order: 4, 
    skippable: false 
  },
  { 
    id: 'cashout', 
    title: 'Cashing Out', 
    description: 'You can cash out at any time to secure your winnings with the current multiplier. The longer you play, the higher the risk and reward!', 
    order: 5, 
    skippable: false 
  },
  { 
    id: 'provably-fair', 
    title: 'Provably Fair Gaming', 
    description: 'Our game uses cryptographic seeds to ensure fairness. You can verify every round result after the game ends.', 
    order: 6, 
    skippable: true 
  },
  { 
    id: 'complete', 
    title: 'Ready to Play!', 
    description: 'You\'re all set! Start your first game and may the odds be in your favor. Good luck!', 
    order: 7, 
    skippable: false 
  },
];
