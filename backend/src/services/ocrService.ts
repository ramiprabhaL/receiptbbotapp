import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface OCRResult {
  merchantName?: string;
  totalAmount?: number;
  date?: Date;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  rawText: string;
  confidence: number;
}

export async function processReceiptOCR(imagePath: string): Promise<OCRResult> {
  try {
    // Preprocess image for better OCR results
    const preprocessedPath = await preprocessImage(imagePath);
    
    // Perform OCR
    const { data } = await Tesseract.recognize(preprocessedPath, 'eng', {
      logger: m => console.log(m) // Log progress
    });

    const rawText = data.text;
    const confidence = data.confidence / 100; // Convert to 0-1 scale

    // Parse structured data from OCR text
    const parsedData = parseReceiptText(rawText);

    // Clean up preprocessed image
    if (preprocessedPath !== imagePath) {
      fs.unlinkSync(preprocessedPath);
    }

    return {
      ...parsedData,
      rawText,
      confidence,
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw new Error('Failed to process receipt with OCR');
  }
}

async function preprocessImage(imagePath: string): Promise<string> {
  try {
    const outputPath = path.join(
      path.dirname(imagePath),
      'processed_' + path.basename(imagePath)
    );

    await sharp(imagePath)
      .resize(2000, null, { // Resize for better OCR
        withoutEnlargement: true
      })
      .greyscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Apply sharpening
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return imagePath; // Return original if preprocessing fails
  }
}

function parseReceiptText(text: string): Partial<OCRResult> {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  const result: Partial<OCRResult> = {};

  // Extract merchant name (usually first or second line)
  if (lines.length > 0) {
    // Look for merchant name in first few lines
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];
      // Skip if line contains numbers or common receipt words
      if (!/\d/.test(line) && 
          !line.toLowerCase().includes('receipt') && 
          !line.toLowerCase().includes('tax') &&
          line.length > 3) {
        result.merchantName = line;
        break;
      }
    }
  }

  // Extract total amount
  const totalRegex = /(?:total|amount|sum)[:\s]*\$?(\d+\.?\d*)/i;
  const totalMatch = text.match(totalRegex);
  if (totalMatch) {
    result.totalAmount = parseFloat(totalMatch[1]);
  } else {
    // Look for dollar amounts at the end of lines
    const amountRegex = /\$(\d+\.?\d*)/g;
    const amounts: number[] = [];
    let match;
    while ((match = amountRegex.exec(text)) !== null) {
      amounts.push(parseFloat(match[1]));
    }
    if (amounts.length > 0) {
      // Use the largest amount as likely total
      result.totalAmount = Math.max(...amounts);
    }
  }

  // Extract date
  const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const parsedDate = new Date(dateMatch[1]);
    if (!isNaN(parsedDate.getTime())) {
      result.date = parsedDate;
    }
  }

  // Extract line items
  const items = parseLineItems(lines);
  if (items.length > 0) {
    result.items = items;
  }

  return result;
}

function parseLineItems(lines: string[]): Array<{ name: string; quantity: number; price: number }> {
  const items: Array<{ name: string; quantity: number; price: number }> = [];
  
  for (const line of lines) {
    // Look for lines with price at the end
    const itemRegex = /^(.+?)\s+(\d*\.?\d*)\s*\$?(\d+\.?\d*)$/;
    const match = line.match(itemRegex);
    
    if (match) {
      const name = match[1].trim();
      const quantityStr = match[2];
      const priceStr = match[3];
      
      if (name && priceStr) {
        const quantity = quantityStr ? parseFloat(quantityStr) : 1;
        const price = parseFloat(priceStr);
        
        if (!isNaN(price) && price > 0) {
          items.push({
            name,
            quantity: isNaN(quantity) ? 1 : quantity,
            price,
          });
        }
      }
    }
  }
  
  return items;
}
