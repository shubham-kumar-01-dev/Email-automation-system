import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const replyQueue = new Queue('reply-check-queue', {
  connection: redisConnection,
});

// Ye function server start hone par call karna hoga
export const scheduleReplyChecks = async () => {
  // Pehle purane jobs saaf karo taaki duplicate na ho
  await replyQueue.obliterate({ force: true });

  // Har 5 minute (300,000 ms) mein check run karo
  await replyQueue.add(
    'check-replies', 
    {}, 
    { 
      repeat: { every: 2 * 60 * 1000 } // 5 Minutes
    }
  );
  
  console.log('⏰ Reply Check Scheduled (Every 5 mins)');
};