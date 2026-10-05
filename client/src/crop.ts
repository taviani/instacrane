export type Frame =
  | { crop: { originX: number; originY: number; width: number; height: number } }
  | { resize: { width?: number; height?: number } };

const portraitRatio = 4 / 5;

export function portraitActions(width: number, height: number): Frame[] {
  if (width < 1 || height < 1) return [];
  let cropW = width;
  let cropH = height;
  if (width / height > portraitRatio) {
    cropW = Math.round(height * portraitRatio);
  } else {
    cropH = Math.round(width / portraitRatio);
  }
  cropW = Math.max(1, Math.min(width, cropW));
  cropH = Math.max(1, Math.min(height, cropH));
  const actions: Frame[] = [
    {
      crop: {
        originX: Math.floor((width - cropW) / 2),
        originY: Math.floor((height - cropH) / 2),
        width: cropW,
        height: cropH,
      },
    },
  ];
  if (cropH > 1440) {
    actions.push({ resize: { width: 1152, height: 1440 } });
  }
  return actions;
}

export function avatarActions(width: number, height: number): Frame[] {
  const long = Math.max(width, height);
  if (width < 1 || height < 1 || long <= 512) return [];
  if (width >= height) return [{ resize: { width: 512 } }];
  return [{ resize: { height: 512 } }];
}
