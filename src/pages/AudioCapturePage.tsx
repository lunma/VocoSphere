import { Card, Space, Alert, Button, Tabs, List, Empty, Tag, Typography, Select } from 'antd'

import { useAsr, type AsrResultMessage } from '../context/AppContext'

import type { TabsProps } from 'antd'

const { Text } = Typography

const AudioCapturePage = () => {
  const {
    handleStartAudioCapture,
    handleStopAudioCapture,
    isCapturing,
    audioStatus,
    asrResults,
    clearAsrResults,
    formatTimeRange,
    audioDevices,
    selectedDevice,
    setSelectedDevice,
    refreshAudioDevices,
  } = useAsr()

  const transcriptionResults = asrResults.filter(
    (item: AsrResultMessage) => item.kind === 'transcription'
  )
  const translationResults = asrResults.filter(
    (item: AsrResultMessage) => item.kind === 'translation'
  )

  const tabsItems: TabsProps['items'] = [
    {
      key: 'transcription',
      label: `识别文本 (${transcriptionResults.length})`,
      children:
        transcriptionResults.length === 0 ? (
          <Empty description="暂未收到识别文本" style={{ padding: '32px 0' }} />
        ) : (
          <List
            dataSource={transcriptionResults}
            split
            renderItem={(result: AsrResultMessage) => (
              <List.Item key={`transcription-${result.sentence_id}-${result.lang ?? 'default'}`}>
                <List.Item.Meta
                  title={
                    <Space size={8} wrap>
                      <Tag color={result.is_final ? 'blue' : 'gold'}>
                        {result.is_final ? '最终' : '临时'}
                      </Tag>
                      <Text type="secondary">
                        句子 #{result.sentence_id} ·{' '}
                        {formatTimeRange(result.begin_time, result.end_time)}
                      </Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text>{result.text || '（空）'}</Text>
                      {result.lang && <Tag>{result.lang.toUpperCase()}</Tag>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ),
    },
    {
      key: 'translation',
      label: `翻译文本 (${translationResults.length})`,
      children:
        translationResults.length === 0 ? (
          <Empty description="暂未收到翻译文本" style={{ padding: '32px 0' }} />
        ) : (
          <List
            dataSource={translationResults}
            split
            renderItem={(result: AsrResultMessage) => (
              <List.Item key={`translation-${result.sentence_id}-${result.lang ?? 'default'}`}>
                <List.Item.Meta
                  title={
                    <Space size={8} wrap>
                      <Tag color={result.is_final ? 'green' : 'gold'}>
                        {result.is_final ? '最终' : '临时'}
                      </Tag>
                      <Text type="secondary">
                        句子 #{result.sentence_id} ·{' '}
                        {formatTimeRange(result.begin_time, result.end_time)}
                      </Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text>{result.text || '（空）'}</Text>
                      {result.lang && <Tag color="blue">目标语言: {result.lang.toUpperCase()}</Tag>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ),
    },
  ]

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card title="音频捕获控制" bordered={false}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space size={12} wrap>
            <Select
              style={{ minWidth: 300 }}
              placeholder="选择音频捕获设备"
              value={selectedDevice}
              onChange={setSelectedDevice}
              disabled={isCapturing}
              options={audioDevices.map((device) => ({
                label: device.label,
                value: device.name,
              }))}
              notFoundContent="暂无可用设备"
            />
            <Button onClick={refreshAudioDevices} disabled={isCapturing}>
              🔄 刷新设备
            </Button>
          </Space>
          <Space size={12} wrap>
            <Button type="primary" onClick={handleStartAudioCapture} disabled={isCapturing}>
              {isCapturing ? '运行中...' : '🎤 启动音频捕获'}
            </Button>
            <Button danger onClick={handleStopAudioCapture} disabled={!isCapturing}>
              ⏹️ 停止捕获
            </Button>
          </Space>
        </Space>
        {audioStatus && (
          <Alert
            style={{ marginTop: 16 }}
            type={isCapturing ? 'success' : 'info'}
            message={audioStatus}
            showIcon
          />
        )}
      </Card>

      <Card
        title="识别输出"
        bordered={false}
        extra={
          <Space size={12}>
            <Tag color="blue">累计 {asrResults.length}</Tag>
            <Button onClick={clearAsrResults}>清空结果</Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="transcription" items={tabsItems} />
      </Card>
    </Space>
  )
}

export default AudioCapturePage
