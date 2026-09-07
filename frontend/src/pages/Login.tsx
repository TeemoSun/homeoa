import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { api, errMsg } from '../api/client'
import { useAuth } from '../store/auth'
import { required } from '../utils/validators'
import type { User } from '../api/types'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
        username: username.trim(),
        password,
      })
      login(data.token, data.user)
      toast.success(`欢迎回来，${data.user.display_name}`)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      toast.danger(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <Card className="glass w-full max-w-sm rounded-3xl shadow-2xl shadow-black/10">
        <Card.Content className="flex flex-col gap-1 p-8">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-3xl bg-accent text-2xl font-bold text-white shadow-xl shadow-accent/30">
              H
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">HomeOA</h1>
              <p className="mt-1 text-sm text-black/45">家庭 OA 审批系统</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <TextField
              value={username}
              onChange={setUsername}
              isRequired
              validate={required('请输入用户名')}
              className="flex flex-col gap-1.5"
            >
              <Label>用户名</Label>
              <Input type="text" placeholder="用户名" autoComplete="username" />
              <FieldError />
            </TextField>
            <TextField
              value={password}
              onChange={setPassword}
              isRequired
              validate={required('请输入密码')}
              className="flex flex-col gap-1.5"
            >
              <Label>密码</Label>
              <Input type="password" placeholder="密码" autoComplete="current-password" />
              <FieldError />
            </TextField>
            <Button type="submit" isPending={loading} fullWidth className="mt-2">
              登录
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  )
}
