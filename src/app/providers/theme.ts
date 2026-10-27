import { theme, type ThemeConfig } from "antd";

/**
 * The single source of design tokens. Both the authenticated shell and the public
 * pages consume this, so a token that is defined once cannot silently fall back to an
 * Ant Design default on one side of the sign-in boundary — which previously gave the
 * login page a different error red, success green and heading scale from the app.
 */
const baseToken = {
  borderRadius: 3,
  borderRadiusLG: 4,
  colorBgContainer: "#ffffff",
  colorBgLayout: "#f5f6f8",
  colorBorder: "#dfe3ea",
  colorBorderSecondary: "#edf0f4",
  colorError: "#c53b3b",
  colorInfo: "#2668d9",
  colorPrimary: "#2668d9",
  colorSuccess: "#2f8a62",
  colorText: "#172033",
  colorTextDescription: "#5f6878",
  colorTextPlaceholder: "#5f6878",
  colorTextSecondary: "#5f6878",
  colorWarning: "#ad6800",
  controlHeight: 34,
  controlHeightLG: 38,
  controlHeightSM: 30,
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  fontSize: 14,
  fontSizeHeading1: 24,
  fontSizeHeading2: 16,
  lineHeight: 1.5,
} as const satisfies ThemeConfig["token"];

export const appTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: baseToken,
  components: {
    Button: {
      defaultShadow: "none",
      primaryShadow: "none",
    },
    Card: {
      bodyPadding: 16,
      headerBg: "#ffffff",
      headerHeight: 44,
    },
    Layout: {
      bodyBg: "#f5f6f8",
      headerBg: "#ffffff",
      headerHeight: 56,
      siderBg: "#f5f6f8",
    },
    Menu: {
      itemBorderRadius: 3,
      itemHeight: 38,
    },
  },
};

/**
 * The public sign-in surface deliberately keeps a softer corner radius to match the
 * marketing-style auth card. Every other token stays shared, so this is the only
 * intentional difference rather than an accidental gap.
 */
export const publicTheme: ThemeConfig = {
  ...appTheme,
  token: {
    ...baseToken,
    borderRadius: 8,
    borderRadiusLG: 8,
  },
};
