import axios, { InternalAxiosRequestConfig } from 'axios'

export const TOKEN_KEY = 'playmate_token'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

type RequestConfigWithAuthControl = InternalAxiosRequestConfig & {
  skipAuth?: boolean
}

// Attach backend JWT to every request if available
api.interceptors.request.use((config: RequestConfigWithAuthControl) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && token !== 'null' && token !== 'undefined' && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle responses: 401 clears auth and redirects to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      // Redirect to login only if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}
