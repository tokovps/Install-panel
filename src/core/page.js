import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const pages = new Map();

export const PageEngine = {
  /**
   * Autoloader for Pages
   */
  loadPages: async () => {
    const pagesDir = path.join(process.cwd(), 'src', 'pages');
    
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }

    const files = fs.readdirSync(pagesDir);
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'index.js') {
        try {
          const filePath = path.join(pagesDir, file);
          const module = await import(`file://${filePath}`);
          const page = module.default || module;
          
          if (page && page.id && typeof page.render === 'function') {
            pages.set(page.id, page);
            logger.info(`Loaded page: ${page.id} (${file})`);
          } else {
            logger.warn(`Skipping invalid page file: ${file}`);
          }
        } catch (err) {
          logger.error(`Error loading page ${file}`, err);
        }
      }
    }
  },

  /**
   * Get a registered page by ID
   * @param {string} pageId 
   * @returns {Object|null}
   */
  getPage: (pageId) => {
    return pages.get(pageId) || null;
  }
};
