export type GenerationStatus = 'pending' | 'processing' | 'done' | 'error';

export interface GenerationJob {
  id: string;
  projectId: string;
  status: GenerationStatus;
  totalCount: number;
  processedCount: number;
  zipStorageUrl: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
}
