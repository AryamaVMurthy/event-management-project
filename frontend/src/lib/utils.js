// Utils: Module level logic for the feature area.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

// Cn: Runs Cn flow. Inputs: ...inputs. Returns: a function result.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
