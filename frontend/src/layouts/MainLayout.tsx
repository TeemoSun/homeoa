import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Layout, Nav } from '@douyinfe/semi-ui'
import {
  IconHistogram,
  IconPlus,
  IconList,
  IconTick,
  IconVerify,
  IconUserGroup,
  IconSetting,
  IconMail,
} from '@douyinfe/semi-icons'
import { useAuth } from '../store/auth'
import type { ReactNode } from 'react'

const { Sider, Header, Content } = Layout

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  const items: { itemKey: string; text: string; icon: ReactNode }[] = [
    { itemKey: '/', text: '仪表盘', icon: <IconHistogram /> },
    { itemKey: '/requests/new', text: '发起请求', icon: <IconPlus /> },
    { itemKey: '/requests', text: '我的请求', icon: <IconList /> },
    { itemKey: '/approvals', text: '待我审批', icon: <IconTick /> },
    ...(isAdmin
      ? [
          { itemKey: '/manage/requests', text: '请求管理', icon: <IconVerify /> },
          { itemKey: '/manage/users', text: '成员管理', icon: <IconUserGroup /> },
          { itemKey: '/manage/mail-logs', text: '邮件日志', icon: <IconMail /> },
        ]
      : []),
    { itemKey: '/settings', text: '个人设置', icon: <IconSetting /> },
  ]

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
        <Nav
          style={{ height: '100%' }}
          selectedKeys={[location.pathname]}
          items={items.map((it) => ({ itemKey: it.itemKey, text: it.text, icon: it.icon }))}
          header={{ text: 'HomeOA 家庭审批', logo: undefined }}
          footer={{ collapseButton: true }}
          onSelect={(data) => navigate(String(data.itemKey))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '8px 24px',
            backgroundColor: 'var(--semi-color-bg-1)',
          }}
        >
          <Dropdown
            position="bottomRight"
            render={
              <Dropdown.Menu>
                <Dropdown.Item
                  onClick={() => {
                    if (user) navigate('/settings')
                  }}
                >
                  个人设置
                </Dropdown.Item>
                <Dropdown.Item
                  type="danger"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  退出登录
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" color="blue">
                {(user?.display_name || user?.username || '?').slice(0, 1)}
              </Avatar>
              {user?.display_name}
              {isAdmin ? '（管理员）' : ''}
            </span>
          </Dropdown>
        </Header>
        <Content style={{ overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
