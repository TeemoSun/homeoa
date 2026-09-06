import { Button, Card, Form, Toast } from '@douyinfe/semi-ui'
import { api, errMsg } from '../api/client'
import { useAuth } from '../store/auth'
import type { User } from '../api/types'

export default function Settings() {
  const { user, updateUser } = useAuth()

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h2 className="page-title">个人设置</h2>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Form
          key={user?.id ?? 'anon'}
          initValues={{
            display_name: user?.display_name,
            email: user?.email,
            mail_enabled: user?.mail_enabled ?? true,
          }}
          onSubmit={async (values) => {
            try {
              const { data } = await api.put<User>('/users/me', values)
              updateUser(data)
              Toast.success('已保存')
            } catch (e) {
              Toast.error(errMsg(e))
            }
          }}
          labelPosition="top"
        >
          <Form.Input field="display_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]} />
          <Form.Input
            field="email"
            label="邮箱（审批通知将发送到该邮箱）"
            rules={[{ type: 'email', message: '邮箱格式不正确' }]}
            showClear
          />
          <Form.Checkbox field="mail_enabled">接收邮件通知</Form.Checkbox>
          <Button htmlType="submit" type="primary" theme="solid">
            保存
          </Button>
        </Form>
      </Card>

      <Card title="修改密码">
        <Form
          onSubmit={async (values: { old_password: string; new_password: string; confirm: string }) => {
            if (values.new_password !== values.confirm) {
              Toast.error('两次输入的新密码不一致')
              return
            }
            try {
              const { data } = await api.put<User>('/users/me', {
                old_password: values.old_password,
                new_password: values.new_password,
              })
              updateUser(data)
              Toast.success('密码已修改')
            } catch (e) {
              Toast.error(errMsg(e))
            }
          }}
          labelPosition="top"
        >
          <Form.Input field="old_password" label="原密码" mode="password" rules={[{ required: true, message: '请输入原密码' }]} />
          <Form.Input
            field="new_password"
            label="新密码"
            mode="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '至少 8 位' },
            ]}
          />
          <Form.Input field="confirm" label="确认新密码" mode="password" rules={[{ required: true, message: '请再次输入新密码' }]} />
          <Button htmlType="submit" type="primary" theme="solid">
            修改密码
          </Button>
        </Form>
      </Card>
    </div>
  )
}
