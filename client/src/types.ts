export type Owner = {
  sub: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Person = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follow_request?: string;
};

export type Profile = Person & {
  followers_count: number;
  following_count: number;
  blocked: boolean;
};

export type Photo = {
  position: number;
  url: string;
};

export type Comment = {
  id: string;
  username: string;
  display_name: string | null;
  body: string;
  created_at: string;
};

export type Post = {
  id: string;
  created_at: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  photos: Photo[];
  likes_count: number;
  comments_count: number;
  liked: boolean;
  comments?: Comment[];
};

export type GridPost = {
  id: string;
  created_at: string;
  thumbnail_url: string | null;
  photo_count: number;
};

export type Note = {
  id: string;
  type: string;
  created_at: string;
  is_read: boolean;
  post_id: string | null;
  actor: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type Coords = {
  latitude: number;
  longitude: number;
};
