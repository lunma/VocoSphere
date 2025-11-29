import { HistoryOutlined } from '@ant-design/icons'
import { Card, Space, Button, Empty, List, Tag, Typography, Select } from 'antd'
import { useEffect, useState } from 'react'

import { useLogs, type LogMessage } from '../context/AppContext'

const { Text } = Typography

const LogsPage = () => {
  const {
    logs,
    clearLogs,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
    logsContainerRef,
    logsEndRef,
    getLogBgColor,
    handleTestLogs,
  } = useLogs()
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(false)
    }
  }, [autoScroll, scrollToBottom])

  const [levelFilter, setLevelFilter] = useState<string>('ALL')

  const filteredLogs =
    levelFilter === 'ALL' ? logs : logs.filter((log) => log.level === levelFilter)

  const levelOptions = [
    { label: '全部日志', value: 'ALL' },
    { label: 'DEBUG', value: 'DEBUG' },
    { label: 'INFO', value: 'INFO' },
    { label: 'WARN', value: 'WARN' },
    { label: 'ERROR', value: 'ERROR' },
  ]

  const logTagColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'red'
      case 'WARN':
        return 'orange'
      case 'INFO':
        return 'blue'
      default:
        return 'default'
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        bordered={false}
        title={
          <Space align="center" size={8}>
            <HistoryOutlined />
            <span>运行日志</span>
            <Tag color="geekblue">{logs.length}</Tag>
          </Space>
        }
        extra={
          <Space size={12}>
            <Button onClick={handleTestLogs}>发送测试日志</Button>
            <Button onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? '关闭自动滚动' : '开启自动滚动'}
            </Button>
            <Button danger onClick={clearLogs}>
              清空日志
            </Button>
          </Space>
        }
      >
        <Space
          style={{
            marginBottom: 12,
            width: '100%',
            justifyContent: 'flex-start',
          }}
        >
          <Select
            style={{ minWidth: 200 }}
            value={levelFilter}
            options={levelOptions}
            onChange={(value) => {
              setLevelFilter(value)
            }}
          />
        </Space>

        <div
          ref={logsContainerRef}
          style={{
            maxHeight: 510,
            overflowY: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            background: '#fff',
            padding: '4px 0',
          }}
        >
          <List
            dataSource={filteredLogs}
            locale={{ emptyText: <Empty description="暂无日志" style={{ padding: '32px 0' }} /> }}
            renderItem={(log: LogMessage, index: number) => (
              <List.Item
                key={`${log.timestamp}-${index}`}
                style={{
                  background: getLogBgColor(log.level),
                  margin: '4px 12px',
                  borderRadius: 6,
                  padding: '12px 16px',
                  border: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space size={12} wrap>
                    <Tag color={logTagColor(log.level)}>{log.level}</Tag>
                    <Text type="secondary">{log.timestamp}</Text>
                    <Text type="secondary">{log.target}</Text>
                  </Space>
                  <Text>{log.message}</Text>
                </Space>
              </List.Item>
            )}
          />
          <div ref={logsEndRef} />
        </div>
      </Card>
    </Space>
  )
}

export default LogsPage
