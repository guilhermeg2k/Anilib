import { SQUARE_BRACKET_CONTENT_EXPRESSION } from '@backend/constants/regexConstants';
import { Anime } from '@backend/database/types';
import client from '@backend/library/graphql';
import AnimeRepository from '@backend/repository/animeRepository';
import fs from 'fs';
import { gql } from 'graphql-request';
import path from 'path';

const animeRepository = new AnimeRepository();
const fsPromises = fs.promises;

interface AnilistAnime {
  id: number;
  title: {
    romaji: string;
    english: string;
    native: string;
  };
  coverImage: {
    extraLarge: string;
  };
  description: string;
  episodes: number;
  startDate: {
    year: number;
    month: number;
    day: number;
  };
  status: string;
  genres: Array<string>;
  format: string;
}

class AnimeService {
  list() {
    const animes = animeRepository.list();
    return animes;
  }

  getById(id: string) {
    const anime = animeRepository.getById(id);
    return anime;
  }

  getByPath(path: string) {
    const anime = animeRepository.listByPath(path);
    return anime;
  }

  async createFromDirectories(directories: Array<string>) {
    const createdAnimesPromises = directories.map(async (directory) =>
      this.createFromDirectory(directory)
    );
    const createdAnimes = await Promise.all(createdAnimesPromises);
    return createdAnimes.flat(Infinity);
  }

  private async createFromDirectory(directory: string) {
    const createdAnimes = Array<Anime>();
    const directoryExists = fs.existsSync(directory);
    if (directoryExists) {
      const directoryFolders = await fsPromises.readdir(directory);
      for (const folder of directoryFolders) {
        const folderPath = path.join(directory, folder);
        const fileStat = await fsPromises.stat(folderPath);
        if (fileStat.isDirectory()) {
          const localAnime = animeRepository.listByPath(folderPath);
          if (!localAnime) {
            const searchText = folder.replaceAll(
              SQUARE_BRACKET_CONTENT_EXPRESSION,
              ''
            );
            const createdAnime =
              await this.createFromDirectoryBySearchOnAnilist(
                folderPath,
                searchText
              );
            createdAnimes.push(createdAnime);
          }
        }
      }
    }
    return createdAnimes;
  }

  private async createFromDirectoryBySearchOnAnilist(
    directory: string,
    searchText: string
  ) {
    const queryResult = await client.request(gql`
      {
        Media(search: "${searchText}", type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
          }
          description
          episodes
          startDate {
            year
            month
            day
          }
          status
          genres
          format
        }
      }
    `);
    const anime = queryResult.Media as AnilistAnime;
    const releaseDate = new Date();
    releaseDate.setFullYear(anime.startDate.year);
    releaseDate.setMonth(anime.startDate.month);
    releaseDate.setDate(anime.startDate.day);

    const animeParsed = {
      anilistId: anime.id,
      title: anime.title,
      coverUrl: anime.coverImage.extraLarge,
      description: anime.description,
      episodes: anime.episodes,
      releaseDate: releaseDate,
      status: anime.status,
      genres: anime.genres,
      format: anime.format,
      folderPath: directory,
    };

    const createdAnime = animeRepository.create(animeParsed);

    return createdAnime;
  }

  private async getEpisodeFilesPaths(folder: string) {
    const episodeFileExtensions = ['.mkv', '.mp4'];
    const folderDir = await fsPromises.readdir(folder);

    const episodeFilesPromises = folderDir.map(async (file: string) => {
      const filePath = path.join(folder, file);
      const fileStats = await fsPromises.stat(filePath);
      const isFile = fileStats.isFile();
      const isDir = fileStats.isDirectory();
      if (isFile) {
        const fileExt = path.extname(filePath);
        if (episodeFileExtensions.includes(fileExt)) {
          return filePath;
        }
      } else if (isDir) {
        return this.getEpisodeFilesPaths(filePath);
      }
      return null;
    });

    const episodeFiles = (await Promise.all(episodeFilesPromises)) as Array<
      string | Array<string>
    >;
    const flattedEpisodeFiles = episodeFiles.flat(Infinity) as Array<string>;
    const notNullEpisodeFiles = flattedEpisodeFiles.filter((episodeFile) =>
      Boolean(episodeFile)
    );
    return notNullEpisodeFiles;
  }

  deleteInvalidAnimes() {
    const invalidAnimes = this.list().filter(
      (anime) => !fs.existsSync(anime.folderPath)
    );

    invalidAnimes.forEach((invalidAnime) =>
      animeRepository.deleteById(invalidAnime.id!)
    );
  }
}

export default AnimeService;
