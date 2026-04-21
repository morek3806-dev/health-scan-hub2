import { parse, isValid } from 'date-fns';

export type ParsedResult = {
  batchNumber?: string;
  expiryDate?: string;
  priceMinor?: number;
  medicineName?: string;
};

export const parseOcrText = (text: string): ParsedResult => {
  const result: ParsedResult = {};
  
  // Batch number
  const batchMatch = text.match(/(?:batch|b\.?no\.?|lot)\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
  if (batchMatch && batchMatch[1]) {
    result.batchNumber = batchMatch[1].trim();
  }

  // Expiry
  const expMatch = text.match(/(?:exp(?:iry)?|use\s*before|best\s*before)\s*[:.]?\s*([A-Za-z0-9 \/-]{4,12})/i);
  if (expMatch && expMatch[1]) {
    const rawExp = expMatch[1].trim();
    // Try to normalize to an ISO string if possible, else just use the raw text and let the user fix it.
    let parsedDate = parse(rawExp, 'MM/yyyy', new Date());
    if (!isValid(parsedDate)) parsedDate = parse(rawExp, 'dd/MM/yyyy', new Date());
    if (!isValid(parsedDate)) parsedDate = parse(rawExp, 'yyyy-MM', new Date());
    if (!isValid(parsedDate)) parsedDate = parse(rawExp, 'MMM yyyy', new Date());
    
    if (isValid(parsedDate)) {
      result.expiryDate = parsedDate.toISOString();
    }
  }

  // Price
  const priceMatch = text.match(/(?:mrp|price|₹|rs\.?|\$)\s*[:.]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (priceMatch && priceMatch[1]) {
    const val = parseFloat(priceMatch[1].trim());
    if (!isNaN(val)) {
      result.priceMinor = Math.round(val * 100);
    }
  }

  // Medicine name - longest mostly uppercase line in first 8 non-empty lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const firstLines = lines.slice(0, 8);
  
  let longestUpperLine = '';
  for (const line of firstLines) {
    const upperCount = (line.match(/[A-Z]/g) || []).length;
    const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 3 && upperCount / letterCount > 0.6) {
      if (line.length > longestUpperLine.length && !line.toLowerCase().includes('pharmacy') && !line.toLowerCase().includes('hospital')) {
        longestUpperLine = line;
      }
    }
  }

  if (longestUpperLine) {
    result.medicineName = longestUpperLine.replace(/[^A-Za-z0-9 .]/g, '').trim();
  }

  return result;
};
