import axios from 'axios'

const TOKEN_KEY = 'homeoa_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const api = axios.create({ baseURL: '/api/v1', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && !location.pathname.startsWith('/login')) {
      setToken(null)
      location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? '请求失败，请稍后再试'
}

// 时间展示：后端返回 UTC/带时区时间，统一本地化
export function fmtTime(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function fmtDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('zh-CN')
}

export function fmtAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  return `¥${amount.toFixed(2)}`
}
