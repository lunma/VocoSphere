import { Card, Space, Button, Empty, List, Tag, Typography } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { useLogs, type LogMessage } from '../context/AppContext'

const { Text } = Typography

const LogsPage = () => {
  const {
    logs,
    clearLogs,
    autoScroll,
    setAutoScroll,
    showLogs,
    setShowLogs,
    scrollToBottom,
    logsContainerRef,
    logsEndRef,
    handleLogsScroll,
    markUserScrolling,
    getLogColor,
    getLogBgColor,
    handleTestLogs,
  } = useLogs()

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
            <Button onClick={() => setShowLogs(!showLogs)}>
              {showLogs ? '隐藏日志' : '显示日志'}
            </Button>
            <Button
              onClick={() => {
                setAutoScroll(true)
                scrollToBottom(false)
              }}
              disabled={autoScroll}
            >
              {autoScroll ? '自动滚动中' : '开启自动滚动'}
            </Button>
            <Button danger onClick={clearLogs}>
              清空日志
            </Button>
          </Space>
        }
      >
        {showLogs ? (
          <div
            ref={logsContainerRef}
            onScroll={handleLogsScroll}
            onWheel={markUserScrolling}
            onTouchStart={markUserScrolling}
            onTouchMove={markUserScrolling}
            onPointerDown={markUserScrolling}
            style={{
              maxHeight: 420,
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              background: '#fff',
              padding: '4px 0',
            }}
          >
            <List
              dataSource={logs}
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
        ) : (
          <Empty description="日志已隐藏" style={{ padding: '48px 0' }} />
        )}
      </Card>
    </Space>
  )
}

export default LogsPage
