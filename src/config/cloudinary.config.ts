import { registerAs } from '@nestjs/config';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export default registerAs<CloudinaryConfig>(
  'cloudinary',
  (): CloudinaryConfig => ({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  }),
);
