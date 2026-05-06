// Shared ECharts color tokens for light vs dark mode
export function chartTheme(isDark: boolean) {
  return {
    bg:        isDark ? "transparent" : "#fff",
    title:     isDark ? "#F1F5F9"    : "#1E293B",
    axisLabel: isDark ? "#94A3B8"    : "#94A3B8",
    splitLine: isDark ? "#1F2937"    : "#F1F5F9",
    axisLine:  isDark ? "#374151"    : "#E2E8F0",
    tooltip: {
      backgroundColor: isDark ? "#1F2937" : "#fff",
      borderColor:     isDark ? "#374151" : "#E2E8F0",
      textStyle:       { color: isDark ? "#CBD5E1" : "#1E293B" },
    },
  };
}
