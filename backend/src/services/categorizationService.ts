interface CategorizationInput {
  merchantName: string;
  items?: Array<{ name: string; price: number }>;
  description?: string;
}

const CATEGORY_KEYWORDS = {
  'Food & Dining': [
    'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'food', 'deli', 'bakery',
    'bar', 'pub', 'grill', 'bistro', 'kitchen', 'dining', 'eatery', 'takeout', 'delivery',
    'mcdonalds', 'starbucks', 'subway', 'kfc', 'dominos', 'pizza hut', 'taco bell',
    'grocery', 'supermarket', 'walmart', 'target', 'kroger', 'safeway', 'whole foods'
  ],
  'Transportation': [
    'gas', 'fuel', 'petrol', 'shell', 'bp', 'exxon', 'chevron', 'uber', 'lyft', 'taxi',
    'bus', 'train', 'subway', 'metro', 'parking', 'toll', 'airline', 'flight', 'airport'
  ],
  'Shopping': [
    'amazon', 'ebay', 'store', 'shop', 'retail', 'mall', 'department', 'clothing',
    'fashion', 'shoes', 'electronics', 'best buy', 'apple store', 'nike', 'adidas'
  ],
  'Entertainment': [
    'movie', 'cinema', 'theater', 'concert', 'tickets', 'game', 'sports', 'netflix',
    'spotify', 'music', 'entertainment', 'amusement', 'park', 'zoo', 'museum'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'medical', 'pharmacy', 'cvs', 'walgreens', 'prescription',
    'dental', 'vision', 'health', 'medicine', 'drug', 'therapy', 'treatment'
  ],
  'Travel': [
    'hotel', 'motel', 'resort', 'booking', 'expedia', 'airbnb', 'rental car', 'hertz',
    'avis', 'enterprise', 'travel', 'vacation', 'trip', 'tourism'
  ],
  'Utilities': [
    'electric', 'electricity', 'gas', 'water', 'internet', 'phone', 'cable', 'utilities',
    'bill', 'service', 'att', 'verizon', 'comcast', 'power', 'energy'
  ],
  'Education': [
    'school', 'university', 'college', 'tuition', 'books', 'education', 'learning',
    'course', 'class', 'training', 'certification', 'academic'
  ],
  'Business': [
    'office', 'supplies', 'business', 'professional', 'consulting', 'services',
    'meeting', 'conference', 'equipment', 'software', 'subscription'
  ],
  'Personal Care': [
    'salon', 'spa', 'beauty', 'barber', 'hair', 'nails', 'cosmetics', 'skincare',
    'personal care', 'hygiene', 'grooming', 'wellness'
  ],
  'Home & Garden': [
    'home depot', 'lowes', 'furniture', 'garden', 'hardware', 'tools', 'home improvement',
    'decoration', 'appliances', 'ikea', 'bed bath beyond'
  ],
  'Insurance': [
    'insurance', 'policy', 'premium', 'coverage', 'claim', 'deductible', 'allstate',
    'state farm', 'geico', 'progressive'
  ],
  'Investments': [
    'investment', 'stock', 'bond', 'mutual fund', 'retirement', '401k', 'ira',
    'brokerage', 'trading', 'dividend'
  ],
  'Gifts & Donations': [
    'gift', 'donation', 'charity', 'nonprofit', 'giving', 'present', 'contribution',
    'fundraiser', 'support'
  ]
};

export async function categorizeReceipt(input: CategorizationInput): Promise<string> {
  try {
    const text = [
      input.merchantName,
      input.description || '',
      ...(input.items?.map(item => item.name) || [])
    ].join(' ').toLowerCase();

    // Score each category based on keyword matches
    const categoryScores: { [key: string]: number } = {};
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          // Give higher score for exact merchant name matches
          if (input.merchantName.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3;
          } else {
            score += 1;
          }
        }
      }
      
      categoryScores[category] = score;
    }

    // Find category with highest score
    const bestCategory = Object.entries(categoryScores).reduce((a, b) => 
      categoryScores[a[0]] > categoryScores[b[0]] ? a : b
    );

    // Return best category if it has a score, otherwise return 'Other'
    return bestCategory[1] > 0 ? bestCategory[0] : 'Other';
    
  } catch (error) {
    console.error('Categorization error:', error);
    return 'Other';
  }
}

export function getCategoryKeywords(category: string): string[] {
  return CATEGORY_KEYWORDS[category as keyof typeof CATEGORY_KEYWORDS] || [];
}

export function getAllCategories(): string[] {
  return Object.keys(CATEGORY_KEYWORDS);
}
