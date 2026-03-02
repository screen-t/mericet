// import { backendApi } from './backend-api';

// // Compatibility re-export for underscore-variant imports
// export * from './backend-api';
// export { backendApi } from './backend-api';

// export default backendApi;


import axios, { AxiosInstance } from "axios";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export interface Author {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  author: Author;
}

export interface Post {
  id: number;
  content: string;
  created_at: string;
  author: Author;
}

/*
|--------------------------------------------------------------------------
| AXIOS INSTANCE
|--------------------------------------------------------------------------
*/

const apiClient: AxiosInstance = axios.create({
  baseURL: "https://stonet.onrender.com/", // CHANGE to your backend URL
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

/*
|--------------------------------------------------------------------------
| BACKEND API OBJECT
|--------------------------------------------------------------------------
*/

export const backendApi = {

  /*
  |--------------------------------------------------------------------------
  | POSTS
  |--------------------------------------------------------------------------
  */

  posts: {

    /*
    | Get comments for a post
    | Fully typed → React Query safe
    */
    async getComments(
      postId: number,
      limit: number = 10,
      offset: number = 0
    ): Promise<Comment[]> {

      const response = await apiClient.get<Comment[]>(
        `/posts/${postId}/comments`,
        {
          params: { limit, offset },
        }
      );

      return response.data;
    },

    /*
    | Example: create comment
    */
    async createComment(
      postId: number,
      content: string
    ): Promise<Comment> {

      const response = await apiClient.post<Comment>(
        `/posts/${postId}/comments`,
        { content }
      );

      return response.data;
    },

  },

  /*
  |--------------------------------------------------------------------------
  | USERS (example)
  |--------------------------------------------------------------------------
  */

  users: {

    async getProfile(userId: number) {
      const response = await apiClient.get(`/users/${userId}`);
      return response.data;
    },

  },

};

/*
|--------------------------------------------------------------------------
| EXPORT DEFAULT
|--------------------------------------------------------------------------
*/

export default backendApi;