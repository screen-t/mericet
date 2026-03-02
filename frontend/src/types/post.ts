export interface PostData {
  id: string;
  content: string;
  createdAt: string;

  likes: number;
  comments: number;
  shares: number;

  isLiked: boolean;
  isSaved: boolean;

  visibility: "public" | "connections" | "private"

  author: {
    id:string;
    name: string;
    username: string;
    avatar?: string;
    headline: string;
  };
}