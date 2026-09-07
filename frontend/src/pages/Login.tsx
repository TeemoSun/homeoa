import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Form, Toast } from '@douyinfe/semi-ui'
import { api, errMsg } from '../api/client'
import { useAuth } from '../store/auth'
import type { User } from '../api/types'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', values)
      login(data.token, data.user)
      Toast.success(`欢迎回来，${data.user.display_name}`)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (e) {
      Toast.error(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <Card style={{ width: '100%', maxWidth: 380 }} bodyStyle={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 4px', textAlign: 'center' }}>HomeOA</h1>
        <p style={{ color: 'var(--semi-color-text-2)', textAlign: 'center', margin: '0 0 24px' }}>
          家庭 OA 审批系统
        </p>
        <Form onSubmit={onSubmit}>
          <Form.Input
            field="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
            showClear
          />
          <Form.Input
            field="password"
            label="密码"
            mode="password"
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <Button htmlType="submit" type="primary" theme="solid" block loading={loading} style={{ marginTop: 12 }}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
