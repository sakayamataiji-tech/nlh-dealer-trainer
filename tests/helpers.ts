import { parseCards, type Card } from "@/engine/cards";
export const c = (s: string): Card[] => parseCards(s);
