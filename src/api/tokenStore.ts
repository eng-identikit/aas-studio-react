// Single source of truth for the access token used by the axios interceptors.
// React state (SessionContext) propagates asynchronously; the interceptors need
// the current token synchronously, including right after a refresh. Every write
// path (login, logout, token refresh) MUST go through setAccessToken so a token
// from a previous session can never outlive it.

let accessToken = localStorage.getItem('auth_token') || '';

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string) => {
  accessToken = token;
};
