import { useState } from 'react'
import { Card, Space, Typography, Alert, Input, Button } from 'antd'
import AsrConfig from '../components/AsrConfig'
import { useEnvironment, useAsr } from '../context/AppContext'

const { Text } = Typography

const OverviewPage = () => {
  const { isTauriEnv } = useEnvironment()
  const { setAsrConfig } = useAsr()
  const isDev = import.meta.env.DEV
  const [name, setName] = useState<string>('')
  const [greeting, setGreeting] = useState<string>('')

  const handleGreet = () => {
    // You may replace this mock implementation with a real Rust FFI call
    setGreeting(`你好，${name}!`)
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {isDev && !isTauriEnv && (
        <Alert
          type="warning"
          showIcon
          message={
            <span>
              ⚠️ 请通过 <code>pnpm tauri dev</code> 运行应用以使用 Tauri 功能
            </span>
          }
        />
      )}

      <Card title="模型配置" variant="borderless">
        <AsrConfig onConfigChange={setAsrConfig} />
      </Card>

      {isDev && (
        <Card title="快速测试" variant="borderless">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space size={12} wrap>
              <Input
                value={name}
                placeholder="请输入名字"
                onChange={(e) => setName(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <Button type="primary" onClick={handleGreet}>
                调用 Rust
              </Button>
            </Space>
            {greeting && (
              <Alert type="info" showIcon message={<Text>{greeting}</Text>} />
            )}
          </Space>
        </Card>
      )}
    </Space>
  )
}

export default OverviewPage
