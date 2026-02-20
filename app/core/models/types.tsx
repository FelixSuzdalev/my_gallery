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

export class ArtEvent{
  constructor(
    public id: string, 
    public title: string,
    public description: string,
    public location_name: string,
    public start_date: Date,
    public end_date: Date,
    public external_url: string,
    public created_at: Date,
  ) {}
}