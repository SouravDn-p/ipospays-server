// not using now

import { Request } from 'express';
import multer, { diskStorage, StorageEngine } from 'multer';
import { extname } from 'path';

export const storageConfig = (
  folder: string = './public/uploads/avatars',
): StorageEngine =>
  diskStorage({
    destination: folder,
    filename: (
      req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `${uniqueSuffix}${ext}`);
    },
  });

export const memoryStorageConfig = multer.memoryStorage();
