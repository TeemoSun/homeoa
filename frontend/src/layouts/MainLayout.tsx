import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  useMediaQuery,
  useOverlayState,
} from '@heroui/react'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import {
  IconDashboard,
  IconLayers,
  IconList,
  IconLogout,
  IconMail,
  IconMenu,
  IconPlus,
  IconSettings,
  IconShieldCheck,
  IconUsers,
} from '../components/Icons'
import { useAuth } from '../store/auth'

type NavItem = {
  itemKey: string
  text: string
  icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { itemKey: '/', text: '仪表盘', icon: IconDashboard },
  { itemKey: '/requests/new', text: '发起请求', icon: IconPlus },
  { itemKey: '/requests', text: '我的请求', icon: IconList },
  { itemKey: '/approvals', text: '待我审批', icon: IconShieldCheck },
  { itemKey: '/settings', text: '个人设置', icon: IconSettings },
]

const ADMIN_ITEMS: NavItem[] = [
  { itemKey: '/manage/requests', text: '请求管理', icon: IconList },
  { itemKey: '/manage/types', text: '审批类型', icon: IconLayers },
  { itemKey: '/manage/users', text: '成员管理', icon: IconUsers },
  { itemKey: '/manage/mail-logs', text: '邮件日志', icon: IconMail },
]

function matchesRoute(current: string, itemKey: string): boolean {
  if (itemKey === '/') return current === '/'
  return current === itemKey || current.startsWith(`${itemKey}/`)
}

// 当前路由对应的导航项：取所有命中项中 itemKey 最长的一个，
// 避免「/requests/new」同时命中「/requests/new」与「/requests」导致双高亮
function resolveActiveKey(current: string, items: NavItem[]): string | undefined {
  let best: string | undefined
  for (const it of items) {
    if (matchesRoute(current, it.itemKey) && (best === undefined || it.itemKey.length > best.length)) {
      best = it.itemKey
    }
  }
  return best
}

function NavList({
  current,
  items,
  adminItems,
  onNavigate,
}: {
  current: string
  items: NavItem[]
  adminItems: NavItem[]
  onNavigate: (key: string) => void
}) {
  const all = [...items, ...adminItems]
  const activeKey = resolveActiveKey(current, all)
  const render = (it: NavItem) => {
    const Icon = it.icon
    const active = it.itemKey === activeKey
    return (
      <button
        key={it.itemKey}
        type="button"
        className={`nav-item ${active ? 'active' : ''}`}
        onClick={() => onNavigate(it.itemKey)}
      >
        <Icon className="size-[18px] shrink-0" />
        <span>{it.text}</span>
      </button>
    )
  }
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(render)}
      {adminItems.length > 0 && (
        <>
          <div className="mt-3 mb-1 px-3 text-[11px] font-semibold tracking-wider text-black/35">
            管理
          </div>
          {adminItems.map(render)}
        </>
      )}
    </nav>
  )
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent text-[15px] font-bold text-white shadow-lg shadow-accent/30">
        H
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">HomeOA</div>
        <div className="text-xs text-black/40">家庭审批系统</div>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  const isMobile = useMediaQuery('(max-width: 767px)')
  const drawer = useOverlayState()

  useEffect(() => {
    // 路由变化时收起移动端抽屉
    drawer.close()
  }, [location.pathname])

  const adminItems = isAdmin ? ADMIN_ITEMS : []

  const navigateTo = (key: string) => {
    navigate(key)
    drawer.close()
  }

  const navList = (
    <NavList current={location.pathname} items={NAV_ITEMS} adminItems={adminItems} onNavigate={navigateTo} />
  )

  const userDropdown = (
    <Dropdown.Root>
      <Dropdown.Trigger className="flex items-center gap-2 rounded-full border-0 bg-transparent py-1 pr-2 pl-1 hover:bg-black/5">
        <Avatar size="sm" color="accent">
          {(user?.display_name || user?.username || '?').slice(0, 1)}
        </Avatar>
        <span
          className="max-w-[120px] truncate text-sm font-medium md:max-w-[200px]"
          title={user?.display_name}
        >
          {user?.display_name}
        </span>
        {!isMobile && isAdmin && <span className="text-xs text-black/40">（管理员）</span>}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'settings') navigate('/settings')
            if (key === 'logout') {
              logout()
              navigate('/login')
            }
          }}
        >
          <Dropdown.Item id="settings" textValue="个人设置">
            <IconSettings className="size-4" />
            个人设置
          </Dropdown.Item>
          <Dropdown.Item id="logout" variant="danger" textValue="退出登录">
            <IconLogout className="size-4" />
            退出登录
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 桌面端玻璃侧边栏 */}
      {!isMobile && (
        <aside className="glass-strong flex w-60 shrink-0 flex-col border-r border-black/5">
          <LogoMark />
          <div className="flex-1 overflow-y-auto">{navList}</div>
          <div className="p-4 text-[11px] text-black/30">HomeOA · 家庭审批系统</div>
        </aside>
      )}

      {/* 移动端抽屉导航 */}
      {isMobile && (
        <Drawer.Root isOpen={drawer.isOpen} onOpenChange={drawer.setOpen}>
          <Drawer.Backdrop />
          <Drawer.Content placement="left">
            <Drawer.Dialog className="w-64">
              <Drawer.Header>
                <Drawer.Heading>
                  <LogoMark />
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="p-0">{navList}</Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Root>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 玻璃顶栏 */}
        <header className="glass-strong flex h-14 shrink-0 items-center justify-between border-b border-black/5 px-4 md:px-6">
          {isMobile && (
            <div className="flex items-center gap-2">
              <Button isIconOnly size="sm" variant="ghost" onPress={drawer.open} aria-label="打开菜单">
                <IconMenu className="size-5" />
              </Button>
              <span className="text-base font-bold tracking-tight">HomeOA</span>
            </div>
          )}
          {!isMobile && <div />}
          {userDropdown}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
