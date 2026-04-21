export type MedicineBatch = {
  id: string;
  medicineName: string;
  genericName?: string;
  batchNumber: string;
  expiryDate: string; // ISO date string
  priceMinor: number;
  currency: string;
  verified: boolean;
  catalogId?: string;
  rawOcrText?: string;
  createdAt: number;
};
