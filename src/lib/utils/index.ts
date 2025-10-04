// utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Re-export balance utilities
export * from './balance';

// Re-export USD utilities
export * from './usd-parser';
export * from './usd-converter';

// Env & configs
export function isProductionMode() {
   return process.env.MODE === 'production';
}

// Styling
export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

// String Utils
export function capitalize(text: string) {
   return text
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
}

export function snakeCaseToTitle(text: string) {
   return capitalize(text.replace(/_/g, ' '));
}

export function truncate(text: string, length: number) {
   return text.length > length ? `${text.substring(0, length)}...` : text;
}

// Date Utils
export function formatDate(date: Date | string): string {
   return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
   }).format(new Date(date));
}

export function timeAgo(date: Date | string): string {
   const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000,
   );
   const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
   };

   for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
         return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
      }
   }
   return 'just now';
}

// Number Utils
export function formatNumber(num: number): string {
   return new Intl.NumberFormat('en-US').format(num);
}

export function formatCurrency(amount: number): string {
   return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
   }).format(amount);
}

// Validation Utils
export function isEmail(email: string): boolean {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
   return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
   );
}

// Local Storage Utils
export function setLocalStorage<T>(key: string, value: T): void {
   if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
   }
}

export function getLocalStorage<T>(key: string): T | null {
   if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
   }
   return null;
}

// URL Utils
export function getQueryParam(param: string): string | null {
   if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get(param);
   }
   return null;
}

export function objectToQueryString(obj: Record<string, any>): string {
   return Object.entries(obj)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(
         ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
}

// Array/Object Utils
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
   return array.reduce(
      (groups, item) => {
         const groupKey = String(item[key]);
         return {
            ...groups,
            [groupKey]: [...(groups[groupKey] || []), item],
         };
      },
      {} as Record<string, T[]>,
   );
}

export function debounce<T extends (...args: any[]) => any>(
   func: T,
   wait: number,
): (...args: Parameters<T>) => void {
   let timeout: NodeJS.Timeout;
   return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
   };
}

export function deepClone<T>(obj: T): T {
   return JSON.parse(JSON.stringify(obj));
}

export function formatThousands(
   num: number | string,
   separatedBy?: 'dot' | 'comma',
): string {
   const n = typeof num === 'string' ? parseFloat(num) : num;

   if (isNaN(n)) return '0';

   const locale =
      separatedBy === 'dot'
         ? 'id-ID'
         : separatedBy === 'comma'
           ? 'en-US'
           : 'id-ID';
   return n.toLocaleString(locale);
}

/**
 * Splits words that exceed maxLen into chunks so they can wrap safely.
 *
 * @param text The input sentence
 * @param maxLen Maximum allowed length per word before splitting
 * @returns A new string with long words split by spaces or zero-width spaces
 */
export function splitLongWords(text: string, maxLen = 20): string {
   return text
      .split(' ')
      .map((word) =>
         word.length > maxLen
            ? (word.match(new RegExp(`.{1,${maxLen}}`, 'g'))?.join(' ') ?? word)
            : word,
      )
      .join(' ');
}



