import { User } from "./User";


export interface LoginResponse {
  token: string;
  message: string;
  user: User;
}
