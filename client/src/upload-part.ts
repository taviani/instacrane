export type PhotoPart = {
  name: string;
  type: string;
  bytes: () => Promise<Uint8Array>;
};

export function photoPart(bytes: Uint8Array): PhotoPart {
  return {
    name: 'photo.jpg',
    type: 'image/jpeg',
    bytes: async () => bytes,
  };
}
