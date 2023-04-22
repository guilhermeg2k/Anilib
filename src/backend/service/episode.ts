import {
  BRACES_CONTENT_REGEX,
  NOT_ALPHANUMERIC_REGEX,
  PARENTHESES_CONTENT_REGEX,
  SQUARE_BRACKET_CONTENT_REGEX,
} from '@common/constants/regex';
import { getFilesInDirectoryByExtensions } from '@common/utils/file';
import {
  convertVideoToMp4,
  extractJpgImageFromVideo,
  isAudioCodecSupported,
  isVideoCodecSupported,
  isVideoContainerSupported,
} from '@common/utils/video';
import EpisodeRepository from 'backend/repository/episode';
import { getNumbersSumFromString } from 'common/utils/string';
import fs from 'fs';
import pLimit from 'p-limit';
import path from 'path';
import SettingsService from './settings';
import { Anime, Episode, EpisodeInput } from '@common/types/prisma';

const fsPromises = fs.promises;

const EPISODE_FILES_EXTENSIONS = ['.mp4', '.mkv'];
const EPISODE_IMAGE_COVER_SECOND = 5;

class EpisodeService {
  private static createFromAnimeAndFilePathPromiseLimiter = pLimit(2);

  static list() {
    return EpisodeRepository.list();
  }

  static async listByAnimeId(animeId: string) {
    const episodes = await EpisodeRepository.listByAnimeId(animeId);
    episodes.sort(this.sortByStringNumbersSum);
    return episodes;
  }

  static async getById(id: string) {
    const episode = await EpisodeRepository.getById(id);
    const coverImage = await fsPromises.readFile(episode?.coverImagePath, {
      encoding: 'base64',
    });
    return {
      ...episode,
      coverImage,
    };
  }

  static getByPath(path: string) {
    return EpisodeRepository.getByFilePath(path);
  }

  static getByOriginalPath(path: string) {
    return EpisodeRepository.getByOriginalFilePath(path);
  }

  static async deleteConverted() {
    const convertedEpisodes = await EpisodeRepository.listConverted();

    const deleteConvertedEpisodesPromises = convertedEpisodes.map(
      async (episode) => {
        if (episode.originalFilePath) {
          const fileExists = fs.existsSync(episode.originalFilePath);

          if (fileExists) {
            return fsPromises.unlink(episode.originalFilePath);
          }
        }
      }
    );

    await Promise.all(deleteConvertedEpisodesPromises);
  }

  static async deleteInvalids() {
    const invalidEpisodes = (await this.list()).filter(
      (episode) => !fs.existsSync(episode.filePath)
    );

    for await (const invalidEpisode of invalidEpisodes) {
      await EpisodeRepository.deleteById(invalidEpisode.id);
    }
  }

  static async createFromAnimes(animes: Array<Anime>) {
    const createEpisodesPromises = animes.map(async (anime) => {
      await this.createFromAnime(anime);
    });

    const createdEpisodes = await Promise.all(createEpisodesPromises);
    return createdEpisodes.flat(Infinity);
  }

  private static async createFromAnime(anime: Anime) {
    const episodeFilePaths = await getFilesInDirectoryByExtensions(
      anime.folderPath,
      EPISODE_FILES_EXTENSIONS
    );

    const episodePromises = episodeFilePaths.map(async (episodeFilePath) => {
      const episodeDoesNotExists =
        !(await this.getByPath(episodeFilePath)) &&
        !(await this.getByOriginalPath(episodeFilePath));

      if (episodeDoesNotExists) {
        return this.createFromAnimeAndFilePathPromiseLimiter(() =>
          this.createFromAnimeAndFilePath(anime, episodeFilePath)
        );
      }
    });

    const createdEpisodes = await Promise.all(episodePromises);
    return createdEpisodes.flat(Infinity);
  }

  private static async createFromAnimeAndFilePath(
    anime: Anime,
    episodeFilePath: string
  ) {
    const episodeFileExt = path.extname(episodeFilePath);
    const episodeFileName = path.basename(episodeFilePath, episodeFileExt);
    const episodeTitle = this.buildEpisodeTitle(episodeFileName);
    const episodeFileDir = path.dirname(episodeFilePath);
    const episodeCoverImagePath = await extractJpgImageFromVideo({
      videoFilePath: episodeFilePath,
      secondToExtract: EPISODE_IMAGE_COVER_SECOND,
      outputFileName: 'episode_cover',
      scaleWidth: 1920,
    });

    const newEpisode: EpisodeInput = {
      title: episodeTitle,
      animeID: anime.id,
      coverImagePath: episodeCoverImagePath,
      filePath: episodeFilePath,
      originalFilePath: null,
    };

    if (await this.episodeNeedsToBeConverted(episodeFilePath)) {
      const shouldUseNVENC = await SettingsService.getByName('shouldUseNVENC');

      const episodeFileMp4 = await convertVideoToMp4({
        videoFilePath: episodeFilePath,
        outputDir: episodeFileDir,
        outputFileName: `${episodeFileName} [ANILIB COMPATIBLE]`,
        shouldUseNVENC: shouldUseNVENC.value,
      });

      newEpisode.originalFilePath = episodeFilePath;
      newEpisode.filePath = episodeFileMp4;
    }

    return this.create(newEpisode);
  }

  private static create(episode: EpisodeInput) {
    return EpisodeRepository.create(episode);
  }

  private static buildEpisodeTitle = (episodeFileName: string) => {
    const episodeTitle = episodeFileName
      .replaceAll(SQUARE_BRACKET_CONTENT_REGEX, '')
      .replaceAll(PARENTHESES_CONTENT_REGEX, '')
      .replaceAll(BRACES_CONTENT_REGEX, '')
      .replaceAll(NOT_ALPHANUMERIC_REGEX, ' ')
      .trim();
    return episodeTitle;
  };

  private static sortByStringNumbersSum = (
    episodeA: Episode,
    episodeB: Episode
  ) => {
    const episodeANumbersSum = getNumbersSumFromString(episodeA.title);
    const episodeBNumbersSum = getNumbersSumFromString(episodeB.title);
    return episodeANumbersSum > episodeBNumbersSum ? 1 : -1;
  };

  private static async episodeNeedsToBeConverted(episodeFilePath: string) {
    const isVideoCodecNotSupported = !(await isVideoCodecSupported(
      episodeFilePath
    ));

    const isAudioCodecNotSupported = !(await isAudioCodecSupported(
      episodeFilePath
    ));

    const isVideoContainerNotSupported =
      !isVideoContainerSupported(episodeFilePath);

    return (
      isVideoCodecNotSupported ||
      isVideoContainerNotSupported ||
      isAudioCodecNotSupported
    );
  }
}

export default EpisodeService;
