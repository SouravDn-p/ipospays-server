import { SafeUser } from "../../modules/users/types/user.types.js";

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}
