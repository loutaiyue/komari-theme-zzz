// High-contrast telemetry colors remain legible on the theme's dark chart surface.
const colors = ["#d7ff00", "#aaa9f9", "#64d8bb", "#ffa66f", "#ed91ba", "#8fc7ff", "#e8d09a", "#a9d787"];

export const signalSeriesColor = (index: number): string => {
  if (index < colors.length) return colors[index];
  return `hsl(${Math.round((index * 137.508) % 360)} 70% 70%)`;
};
