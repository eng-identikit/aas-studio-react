import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useSessionContext } from '@/context/SessionContext';
import { getAccessToken, setAccessToken } from '@/api/tokenStore';
import { config } from '@/utils/config';

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

export const useApiManager = () => {
  const { operator, setOperator } = useSessionContext();

  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || config.apiUrl,
  });

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: any) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const expiredToken = getAccessToken();
            const refreshResponse = await axios.get(
              `${(import.meta.env.VITE_API_URL || config.apiUrl) + '/v1/auth/refresh'}`,
              { headers: { Authorization: `Bearer ${expiredToken}` } }
            );
            const new_auth_token = refreshResponse.data.data.auth_token;
            setAccessToken(new_auth_token);

            setOperator({ ...operator, auth_token: new_auth_token });

            failedQueue.forEach(({ resolve }) => resolve(new_auth_token));
            failedQueue = [];

            originalRequest.headers.Authorization = `Bearer ${new_auth_token}`;
            return api(originalRequest);
          } catch (refreshError: any) {
            // Refresh definitively rejected: the session is gone server-side.
            // Fail every queued request too, so callers see the error instead
            // of hanging forever.
            failedQueue.forEach(({ reject }) => reject(refreshError));
            failedQueue = [];
            if (refreshError.response?.status === 403) {
              setAccessToken('');
              setOperator(null);
            }
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      return Promise.reject(error);
    }
  );

  return api;
};
