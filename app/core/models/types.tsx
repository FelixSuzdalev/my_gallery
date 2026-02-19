export enum SortByEnum {
  Popular = 'popular',
  Newest = 'newest',
  Trending = 'trending'
}

export interface Artwork2 {
  id: string;
  title: string;
  image_url: string;
  description?: string | null;
  author_id?: string | null
};