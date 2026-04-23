import { create } from 'zustand';
import { MedicineBatch } from './types';
export type { MedicineBatch };
import { addDays, subDays } from 'date-fns';

type ScanState = {
  imageUrl: string | null;
  parsedData: Partial<MedicineBatch> | null;
  rawText: string | null;
  setScanData: (imageUrl: string, parsedData: Partial<MedicineBatch>, rawText: string) => void;
  clearScanData: () => void;
};

export const useScanStore = create<ScanState>((set) => ({
  imageUrl: null,
  parsedData: null,
  rawText: null,
  setScanData: (imageUrl, parsedData, rawText) => set({ imageUrl, parsedData, rawText }),
  clearScanData: () => set({ imageUrl: null, parsedData: null, rawText: null }),
}));

// LocalStorage Persistence
const STORAGE_KEY = 'smart-scan.batches';

const seedBatches: MedicineBatch[] = [
  {
    id: 'seed-1',
    medicineName: 'Paracetamol 500mg',
    genericName: 'Acetaminophen',
    batchNumber: 'PCT-2023-A1',
    expiryDate: addDays(new Date(), 14).toISOString(),
    priceMinor: 4500, // ₹45.00
    currency: 'INR',
    verified: true,
    catalogId: 'c-paracetamol',
    createdAt: Date.now() - 100000,
  },
  {
    id: 'seed-2',
    medicineName: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    batchNumber: 'AMX-998',
    expiryDate: addDays(new Date(), 90).toISOString(),
    priceMinor: 12000, // ₹120.00
    currency: 'INR',
    verified: true,
    catalogId: 'c-amoxicillin',
    createdAt: Date.now() - 50000,
  },
  {
    id: 'seed-3',
    medicineName: 'Aspirin 75mg',
    genericName: 'Aspirin',
    batchNumber: 'ASP-OLD-4',
    expiryDate: subDays(new Date(), 5).toISOString(),
    priceMinor: 2500, // ₹25.00
    currency: 'INR',
    verified: true,
    catalogId: 'c-aspirin',
    createdAt: Date.now() - 200000,
  }
];

export const getInventory = (): MedicineBatch[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedBatches));
    return seedBatches;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveInventory = (batches: MedicineBatch[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
};

export const addBatch = (batch: MedicineBatch) => {
  const current = getInventory();
  saveInventory([batch, ...current]);
};

export const removeBatch = (id: string) => {
  const current = getInventory();
  saveInventory(current.filter(b => b.id !== id));
};
