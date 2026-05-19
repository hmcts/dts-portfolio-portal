import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui className helper: combines clsx with tailwind-merge
// so conflicting Tailwind utilities collapse to the last one wins.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
