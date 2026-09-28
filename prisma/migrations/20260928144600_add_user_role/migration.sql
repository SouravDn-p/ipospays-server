-- The seed user uses Role.USER. Existing databases were created before that value existed.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER';
