import { ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = {
  host: 'localhost',
  port: 6379,
  // Password agar docker command mein set kiya ho, to yahan daalein
};