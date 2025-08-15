import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://192.168.88.102:6379';

// console.log(`Connecting to Redis at ${redisUrl}`)

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// redis v4 client handles reconnections automatically.
// We connect here and export the connected client.
// The client will queue commands if not connected, and execute them upon connection.
if (!redisClient.isOpen) {
  redisClient.connect().catch(console.error);
}

export default redisClient;
