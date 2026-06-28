/**
 * Card back themes (unlockable).
 */

export const DEFAULT_THEME = 'classic';

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'Classic Blue',
    backPrimary: '#1a3a6b',
    backSecondary: '#2a5aab',
    backAccent: '#4a7abb',
    unlocked: true
  },
  red: {
    id: 'red',
    name: 'Royal Red',
    backPrimary: '#6b1a1a',
    backSecondary: '#ab2a2a',
    backAccent: '#bb4a4a',
    unlocked: false
  },
  green: {
    id: 'green',
    name: 'Forest Green',
    backPrimary: '#1a4b2a',
    backSecondary: '#2a6b3a',
    backAccent: '#4a8b5a',
    unlocked: false
  },
  purple: {
    id: 'purple',
    name: 'Midnight Purple',
    backPrimary: '#3a1a6b',
    backSecondary: '#5a2aab',
    backAccent: '#7a4abb',
    unlocked: false
  },
  gold: {
    id: 'gold',
    name: 'Golden',
    backPrimary: '#6b5a1a',
    backSecondary: '#ab8a2a',
    backAccent: '#bbaa4a',
    unlocked: false
  }
};
