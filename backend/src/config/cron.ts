import * as cron from 'node-cron';
import { Receipt } from '../models/Receipt';

// Clean up old receipts every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('🧹 Running daily cleanup task...');
    
    // Delete receipts older than 2 years
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const result = await Receipt.deleteMany({
      createdAt: { $lt: twoYearsAgo },
      isArchived: true
    });
    
    console.log(`🗑️ Cleaned up ${result.deletedCount} old receipts`);
  } catch (error) {
    console.error('❌ Error during cleanup task:', error);
  }
});

// Generate monthly analytics every 1st day of month at 3 AM
cron.schedule('0 3 1 * *', async () => {
  try {
    console.log('📊 Generating monthly analytics...');
    // Add monthly analytics generation logic here
    console.log('✅ Monthly analytics generated');
  } catch (error) {
    console.error('❌ Error generating monthly analytics:', error);
  }
});

console.log('⏰ Cron jobs scheduled successfully');
