export type StoredSession = {
  baseUrl: string;
  identityServerUrl?: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export const DEFAULT_HOMESERVER_URL = "https://matrix-client.matrix.org";
export const DEFAULT_IDENTITY_SERVER_URL = "https://vector.im";
export const DEFAULT_SESSION_STORAGE_KEY = "matrix-client.session";
