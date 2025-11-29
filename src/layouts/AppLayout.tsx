import { HomeOutlined, SoundOutlined, HistoryOutlined } from '@ant-design/icons'
import { Layout, Menu, Typography, Space, theme } from 'antd'
import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import type { MenuProps } from 'antd'
import type { ReactNode } from 'react'

const { Sider, Content, Header } = Layout
const { Title, Text } = Typography

type SectionPath = '/' | '/audio' | '/logs'

interface MenuItem {
  path: SectionPath
  label: string
  icon: ReactNode
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: '模型配置', icon: <HomeOutlined /> },
  { path: '/audio', label: '音频捕获', icon: <SoundOutlined /> },
  { path: '/logs', label: '运行日志', icon: <HistoryOutlined /> },
]

const AppLayout = () => {
  const { token } = theme.useToken()
  const location = useLocation()
  const navigate = useNavigate()

  const activeKey = useMemo<SectionPath>(() => {
    const match = MENU_ITEMS.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
    )
    return match ? match.path : '/'
  }, [location.pathname])

  const onMenuClick: MenuProps['onClick'] = (info) => {
    const key = info.key as SectionPath
    if (location.pathname !== key) {
      navigate(key)
    }
  }

  return (
    <Layout
      style={{
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Sider
        width={240}
        theme="dark"
        style={{
          background: 'linear-gradient(160deg, #0b1220 0%, #101c33 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.04)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Space direction="vertical" size={2} style={{ padding: '24px 16px' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            VocoSphere
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>实时语音识别与翻译</Text>
        </Space>
        <Menu
          theme="dark"
          mode="inline"
          style={{
            background: 'transparent',
            borderInlineEnd: 'none',
            padding: '8px 12px',
            flex: 1,
            overflow: 'auto',
          }}
          selectedKeys={[activeKey]}
          items={MENU_ITEMS.map((item) => ({
            key: item.path,
            icon: item.icon,
            label: item.label,
          }))}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout
        style={{
          background: token.colorBgLayout,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Header
          style={{
            background: token.colorBgElevated,
            padding: '0 48px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorSplit}`,
            boxShadow: token.boxShadowSecondary,
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}
        >
          <Title level={4} style={{ margin: 0, color: token.colorTextHeading }}>
            {MENU_ITEMS.find((item) => item.path === activeKey)?.label}
          </Title>
        </Header>
        <Content
          style={{
            padding: '32px 0 48px',
            background: token.colorBgLayout,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: '0 auto',
              padding: '0 32px',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
