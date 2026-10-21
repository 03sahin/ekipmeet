export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: User;
};