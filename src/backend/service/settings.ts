import { Setting } from '@common/types/database';
import SettingsRepository from 'backend/repository/settings';

class SettingsService {
  static list() {
    return SettingsRepository.list();
  }

  static getByName(setting: Setting) {
    return SettingsRepository.getByNameOrThrow(setting);
  }

  static set(id: number, value: boolean) {
    return SettingsRepository.set(id, value);
  }
}

export default SettingsService;
