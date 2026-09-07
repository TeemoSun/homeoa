import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  TextField,
  toast,
} from '@heroui/react'
import { api, errMsg } from '../api/client'
import { useAuth } from '../store/auth'
import { CheckOption } from '../components/FieldControls'
import { compose, minLength, optionalEmail, required } from '../utils/validators'
import type { User } from '../api/types'

export default function Settings() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [mailEnabled, setMailEnabled] = useState(user?.mail_enabled ?? true)
  const [savingProfile, setSavingProfile] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { data } = await api.put<User>('/users/me', {
        display_name: displayName.trim(),
        email: email.trim(),
        mail_enabled: mailEnabled,
      })
      updateUser(data)
      toast.success('已保存')
    } catch (err) {
      toast.danger(errMsg(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingPassword(true)
    try {
      // 后端会递增 token_version 使旧 JWT 立即失效，改密后需重新登录
      await api.put<User>('/users/me', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      toast.success('密码已修改，请重新登录')
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      toast.danger(errMsg(err))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="page max-w-[640px]">
      <h2 className="page-title">个人设置</h2>

      <Card className="glass mb-4 rounded-2xl shadow-sm">
        <Card.Header className="pb-1">
          <Card.Title>基本信息</Card.Title>
        </Card.Header>
        <Card.Content className="p-5 pt-2">
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <TextField
              value={displayName}
              onChange={setDisplayName}
              isRequired
              validate={required('请输入姓名')}
              className="flex flex-col gap-1.5"
            >
              <Label>姓名</Label>
              <Input type="text" />
              <FieldError />
            </TextField>
            <TextField
              value={email}
              onChange={setEmail}
              validate={optionalEmail()}
              className="flex flex-col gap-1.5"
            >
              <Label>邮箱（审批通知将发送到该邮箱）</Label>
              <Input type="email" />
              <FieldError />
            </TextField>
            <CheckOption isSelected={mailEnabled} onChange={setMailEnabled}>
              接收邮件通知
            </CheckOption>
            <div>
              <Button type="submit" isPending={savingProfile}>
                保存
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card className="glass rounded-2xl shadow-sm">
        <Card.Header className="pb-1">
          <Card.Title>修改密码</Card.Title>
        </Card.Header>
        <Card.Content className="p-5 pt-2">
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            <TextField
              value={oldPassword}
              onChange={setOldPassword}
              isRequired
              validate={required('请输入原密码')}
              className="flex flex-col gap-1.5"
            >
              <Label>原密码</Label>
              <Input type="password" autoComplete="current-password" />
              <FieldError />
            </TextField>
            <TextField
              value={newPassword}
              onChange={setNewPassword}
              isRequired
              validate={compose(required('请输入新密码'), minLength(8, '至少 8 位'))}
              className="flex flex-col gap-1.5"
            >
              <Label>新密码</Label>
              <Input type="password" autoComplete="new-password" />
              <FieldError />
            </TextField>
            <TextField
              value={confirm}
              onChange={setConfirm}
              isRequired
              validate={compose(
                required('请再次输入新密码'),
                (v) => (v === newPassword ? undefined : '两次输入的新密码不一致'),
              )}
              className="flex flex-col gap-1.5"
            >
              <Label>确认新密码</Label>
              <Input type="password" autoComplete="new-password" />
              <FieldError />
            </TextField>
            <div>
              <Button type="submit" isPending={savingPassword}>
                修改密码
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  )
}
