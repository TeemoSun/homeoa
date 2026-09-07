import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Dropdown, Layout, Nav, SideSheet } from '@douyinfe/semi-ui'
import {
  IconHistogram,
  IconPlus,
  IconList,
  IconTick,
  IconVerify,
  IconUserGroup,
  IconSetting,
  IconMail,
  IconMenu,
} from '@douyinfe/semi-icons'
import { useAuth } from '../store/auth'
import { useEffect, useState, type ReactNode } from 'react'

const { Sider, Header, Content } = Layout

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [drawerVisible, setDrawerVisible] = useState(false)

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        setDrawerVisible(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setDrawerVisible(false)
  }, [location.pathname])

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

  const navContent = (
    <Nav
      style={{ height: '100%' }}
      selectedKeys={[location.pathname]}
      items={items.map((it) => ({ itemKey: it.itemKey, text: it.text, icon: it.icon }))}
      header={{ text: 'HomeOA 家庭审批' }}
      footer={!isMobile ? { collapseButton: true } : undefined}
      onSelect={(data) => {
        navigate(String(data.itemKey))
        if (isMobile) setDrawerVisible(false)
      }}
    />
  )

  const userDropdown = (
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
        <span
          style={{
            maxWidth: isMobile ? 120 : 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 14,
          }}
        >
          {user?.display_name}
        </span>
        {!isMobile && isAdmin && (
          <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>（管理员）</span>
        )}
      </span>
    </Dropdown>
  )

  return (
    <Layout style={{ height: '100vh' }}>
      {!isMobile && (
        <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
          {navContent}
        </Sider>
      )}

      {isMobile && (
        <SideSheet
          visible={drawerVisible}
          onCancel={() => setDrawerVisible(false)}
          placement="left"
          width={250}
          bodyStyle={{ padding: 0 }}
          headerStyle={{ display: 'none' }}
          footer={null}
        >
          {navContent}
        </SideSheet>
      )}

      <Layout style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Header
          style={{
            display: 'flex',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            alignItems: 'center',
            padding: isMobile ? '8px 16px' : '8px 24px',
            backgroundColor: 'var(--semi-color-bg-1)',
            borderBottom: '1px solid var(--semi-color-border)',
            height: 52,
          }}
        >
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Button
                icon={<IconMenu size="large" />}
                theme="borderless"
                type="tertiary"
                onClick={() => setDrawerVisible(true)}
                aria-label="打开菜单"
              />
              <span style={{ fontWeight: 600, fontSize: 16 }}>HomeOA</span>
            </div>
          )}
          {userDropdown}
        </Header>
        <Content style={{ overflow: 'auto', flex: 1 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
