import multer, { Options } from 'multer';

export const imageMulterOptions: Options = {
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(null, false);
      return;
    }

    callback(null, true);
  },
};
