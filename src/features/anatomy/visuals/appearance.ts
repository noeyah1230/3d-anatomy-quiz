export type DisplayMode = 'Focus' | 'Strict Quiz' | 'Context';

export type Appearance = {
  mode: DisplayMode;
  opacity: number;
  bones: boolean;
  muscles: boolean;
};

export const displayModes = ['Focus', 'Strict Quiz', 'Context'] as const;
export const defaultAppearance: Appearance = {
  mode: 'Focus',
  opacity: 50,
  bones: true,
  muscles: true,
};
