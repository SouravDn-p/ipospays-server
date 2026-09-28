import { registerAs } from '@nestjs/config';

export interface DbConfig {
  url: string;
}

export default registerAs<DbConfig>('db', (): DbConfig => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not defined in the environment variables',
    );
  }

  return { url };
});
