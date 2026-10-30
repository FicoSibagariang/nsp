export interface OfficialLetter extends Record<string, unknown> {
  id: string;
  letterNumber: string;
  seqNumber: number;
  category: string;
  letterDate: string;
  partyName: string;
  subject: string;
  description?: string | null;
  amount?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface LetterCategory {
  id: string;
  code: string;
  label: string;
}

export interface LettersResponse {
  data: OfficialLetter[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total: number;
    byCategory: Record<string, number>;
  };
}

export interface CreateLetterInput {
  category: string;
  letterDate: string;
  partyName: string;
  subject: string;
  description?: string | null;
  amount?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  manualLetterNumber?: string | null;
}

export interface UpdateLetterInput {
  partyName: string;
  subject: string;
  description?: string | null;
  amount?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}
