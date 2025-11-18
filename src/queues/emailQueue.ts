import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// "email-queue" naam ki ek line (queue) banayi
export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Agar fail ho to 3 baar try karo
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s... delay badhao retry mein
    },
    removeOnComplete: true, // Successful jobs ko list se hata do
    removeOnFail: false // Failed jobs ko rakho taaki hum dekh sakein
  }
});