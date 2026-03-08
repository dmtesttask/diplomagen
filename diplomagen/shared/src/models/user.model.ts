export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  availableGenerations: number;
  createdAt: Date | string;
}

export interface PromoCode {
  id: string;
  generations: number;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: Date | string | null;
}
