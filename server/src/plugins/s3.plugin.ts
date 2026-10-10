import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Plugin: FastifyPluginAsync = async (fastify) => {
  const accountId = process.env.R2_ACCOUNT_ID || 'dummy_account_id';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'dummy_access_key_id';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'dummy_secret_access_key';
  const bucketName = process.env.R2_BUCKET_NAME || 'darkobarber-photos';

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const generatePresignedUrl = async (key: string, contentType: string): Promise<string> => {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 300 });
  };

  fastify.decorate('generatePresignedUrl', generatePresignedUrl);
};

export default fp(s3Plugin, {
  name: 's3-plugin',
});
