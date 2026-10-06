import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color?: string; size?: number };

export function SearchIcon({ color = '#111111', size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="11" cy="11" r="6" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M16 16.5 20 20.5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileIcon({ color = '#111111', size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="3.2" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M5.5 19.5c1.2-3 3.2-4.5 6.5-4.5s5.3 1.5 6.5 4.5"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BellIcon({ color = '#111111', size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ color = '#111111', size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
