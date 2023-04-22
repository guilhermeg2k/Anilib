import {
  Anime as DBAnime,
  AnimeFormat as DBAnimeFormat,
  AnimeStatus as DBAnimeStatus,
  AnimeTitle as DBAnimeTitle,
  Episode as DBEpisode,
  Genre as DBGenre,
  Season as DBSeason,
  Studio as DBStudio,
  Subtitle as DBSubtitle,
  Prisma,
} from '@prisma/client';

export type Anime = DBAnime;
export type Subtitle = DBSubtitle;
export type AnimeFormat = DBAnimeFormat;
export type AnimeStatus = DBAnimeStatus;
export type AnimeTitle = DBAnimeTitle;
export type Episode = DBEpisode;
export type Genre = DBGenre;
export type Season = DBSeason;
export type Studio = DBStudio;

export type AnimeFormatInput = Prisma.AnimeFormatCreateInput;
export type AnimeStatusInput = Prisma.AnimeStatusCreateInput;
export type AnimeTitleInput = Prisma.AnimeTitleCreateInput;
export type GenreInput = Prisma.GenreCreateInput;
export type SeasonInput = Prisma.SeasonCreateInput;
export type StudioInput = Prisma.StudioCreateInput;

export type AnimeWithAllRelations = Anime & {
  season: Season;
  genres: Genre[];
  studios: Studio[];
  titles: AnimeTitle[];
  episodes: Episode[];
  format: AnimeFormat;
  status: AnimeStatus;
};

export type AnimeCreateInputWithoutRelations = Omit<
  Prisma.AnimeCreateInput,
  'format' | 'status' | 'season' | 'titles' | 'studios' | 'genres' | 'episodes'
>;

export type AnimeUpdateInputWithoutRelations =
  Partial<AnimeCreateInputWithoutRelations>;

export type EpisodeInput = Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>;

export type SubtitleInput = Omit<Subtitle, 'id' | 'createdAt' | 'updatedAt'>;
