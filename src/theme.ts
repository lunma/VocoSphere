import type { ThemeConfig } from 'antd'

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1664ff',
    colorInfo: '#1664ff',
    colorBgBase: '#f5f7fb',
    colorBgLayout: '#f5f7fb',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorTextBase: '#1f262e',
    colorTextSecondary: 'rgba(31, 38, 46, 0.65)',
    colorSplit: '#e5eaf3',
    borderRadius: 10,
    boxShadowSecondary: '0 18px 48px rgba(15, 23, 42, 0.08)',
  },
  components: {
    Layout: {
      bodyBg: '#f5f7fb',
      headerBg: '#ffffff',
      siderBg: '#0d1526',
      headerPadding: '0 32px',
    },
    Menu: {
      itemSelectedBg: 'rgba(22, 100, 255, 0.14)',
      itemSelectedColor: '#1664ff',
      itemHoverColor: '#1664ff',
      itemHoverBg: 'rgba(22, 100, 255, 0.08)',
      itemActiveBg: 'rgba(22, 100, 255, 0.08)',
    },
    Typography: {
      colorTextHeading: '#101828',
    },
    Card: {
      colorBorderSecondary: '#e5eaf3',
      paddingLG: 20,
    },
    Tabs: {
      inkBarColor: '#1664ff',
      itemHoverColor: '#1664ff',
      itemActiveColor: '#1664ff',
      itemSelectedColor: '#1664ff',
      itemColor: '#5e6573',
    },
  },
}
