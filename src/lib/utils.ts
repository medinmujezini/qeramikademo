import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Round a number to 2 decimal places for display */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
