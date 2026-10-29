const Minio = require('minio');

const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: String(process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ROOT_USER || 'cosmeticminio',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'change_me_minio_password'
});
const bucket = process.env.MINIO_BUCKET || 'cosmetic-files';

async function ensureBucket() {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) await client.makeBucket(bucket, 'us-east-1');
      console.log(`[minio] bucket ready: ${bucket}`);
      return;
    } catch (error) {
      if (attempt === 20) throw error;
      console.log(`[minio] waiting (${attempt}/20): ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = { client, bucket, ensureBucket };
