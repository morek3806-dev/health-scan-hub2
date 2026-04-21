export type CatalogEntry = {
  catalogId: string;
  canonicalName: string;
  genericName: string;
  alternatives: { name: string; priceMinor: number }[];
};

export const CATALOG: CatalogEntry[] = [
  {
    catalogId: 'c-paracetamol',
    canonicalName: 'Paracetamol 500mg',
    genericName: 'Acetaminophen',
    alternatives: [
      { name: 'Crocin 500mg', priceMinor: 1500 },
      { name: 'Calpol 500mg', priceMinor: 1800 }
    ]
  },
  {
    catalogId: 'c-ibuprofen',
    canonicalName: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    alternatives: [
      { name: 'Brufen 400mg', priceMinor: 2000 },
      { name: 'Advil 400mg', priceMinor: 2500 }
    ]
  },
  {
    catalogId: 'c-amoxicillin',
    canonicalName: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    alternatives: [
      { name: 'Mox 500', priceMinor: 8000 },
      { name: 'Novamox 500', priceMinor: 9500 }
    ]
  },
  {
    catalogId: 'c-azithromycin',
    canonicalName: 'Azithromycin 500mg',
    genericName: 'Azithromycin',
    alternatives: [
      { name: 'Azee 500', priceMinor: 11000 },
      { name: 'Azithral 500', priceMinor: 11500 }
    ]
  },
  {
    catalogId: 'c-metformin',
    canonicalName: 'Metformin 500mg',
    genericName: 'Metformin',
    alternatives: [
      { name: 'Glycomet 500', priceMinor: 3000 },
      { name: 'Okamet 500', priceMinor: 3500 }
    ]
  },
  {
    catalogId: 'c-atorvastatin',
    canonicalName: 'Atorvastatin 10mg',
    genericName: 'Atorvastatin',
    alternatives: [
      { name: 'Atorva 10', priceMinor: 5000 },
      { name: 'Lipikind 10', priceMinor: 4500 }
    ]
  },
  {
    catalogId: 'c-omeprazole',
    canonicalName: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    alternatives: [
      { name: 'Omez 20', priceMinor: 4000 },
      { name: 'Omee 20', priceMinor: 3800 }
    ]
  },
  {
    catalogId: 'c-cetirizine',
    canonicalName: 'Cetirizine 10mg',
    genericName: 'Cetirizine',
    alternatives: [
      { name: 'Cetzine 10', priceMinor: 2000 },
      { name: 'Alerid 10', priceMinor: 2200 }
    ]
  },
  {
    catalogId: 'c-aspirin',
    canonicalName: 'Aspirin 75mg',
    genericName: 'Aspirin',
    alternatives: [
      { name: 'Ecosprin 75', priceMinor: 1000 },
      { name: 'Sprin 75', priceMinor: 1200 }
    ]
  },
  {
    catalogId: 'c-losartan',
    canonicalName: 'Losartan 50mg',
    genericName: 'Losartan',
    alternatives: [
      { name: 'Losar 50', priceMinor: 6000 },
      { name: 'Repace 50', priceMinor: 6500 }
    ]
  },
  {
    catalogId: 'c-pantoprazole',
    canonicalName: 'Pantoprazole 40mg',
    genericName: 'Pantoprazole',
    alternatives: [
      { name: 'Pan 40', priceMinor: 8000 },
      { name: 'Pantocid 40', priceMinor: 8500 }
    ]
  },
  {
    catalogId: 'c-salbutamol',
    canonicalName: 'Salbutamol Inhaler',
    genericName: 'Salbutamol',
    alternatives: [
      { name: 'Asthalin Inhaler', priceMinor: 15000 },
      { name: 'Aerocort Inhaler', priceMinor: 16000 }
    ]
  }
];

export const lookupCatalog = (name: string): CatalogEntry | undefined => {
  const lowerName = name.toLowerCase();
  return CATALOG.find(
    c => lowerName.includes(c.canonicalName.toLowerCase()) || 
         lowerName.includes(c.genericName.toLowerCase())
  );
};

export type InteractionSeverity = 'MINOR' | 'MODERATE' | 'MAJOR';

export type Interaction = {
  severity: InteractionSeverity;
  description: string;
};

// Maps generic name pairs (alphabetically sorted joined by '+') to an Interaction
const INTERACTIONS_MAP: Record<string, Interaction> = {
  'aspirin+ibuprofen': {
    severity: 'MODERATE',
    description: 'Increased risk of gastrointestinal bleeding and reduced cardioprotective effect of aspirin.'
  },
  'atorvastatin+metformin': {
    severity: 'MINOR',
    description: 'Possible slight increase in blood glucose levels; monitor routine HbA1c.'
  },
  'amoxicillin+azithromycin': {
    severity: 'MAJOR',
    description: 'Potential antagonism in antibacterial effects and increased risk of QT prolongation.'
  },
  'atorvastatin+azithromycin': {
    severity: 'MAJOR',
    description: 'Increased risk of statin-induced myopathy or rhabdomyolysis.'
  },
  'aspirin+losartan': {
    severity: 'MODERATE',
    description: 'Aspirin may reduce the antihypertensive effect of losartan and increase risk of renal impairment.'
  }
};

export const checkInteractions = (newGeneric: string, existingGenerics: string[]): { generic: string, interaction: Interaction }[] => {
  const newG = newGeneric.toLowerCase();
  const alerts: { generic: string, interaction: Interaction }[] = [];
  const checked = new Set<string>();

  for (const ext of existingGenerics) {
    const extG = ext.toLowerCase();
    if (!extG || checked.has(extG) || extG === newG) continue;
    checked.add(extG);
    
    const pair1 = `${newG}+${extG}`;
    const pair2 = `${extG}+${newG}`;
    
    const interaction = INTERACTIONS_MAP[pair1] || INTERACTIONS_MAP[pair2];
    if (interaction) {
      alerts.push({ generic: ext, interaction });
    }
  }

  return alerts;
};
