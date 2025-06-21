export interface SignupResponse {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'USER' | 'ADMIN';
  message: string;
}
