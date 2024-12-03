import { addColors, createLogger, format, LeveledLogMethod, Logger, transports, transport } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { __logPath } from './globals.js';
import { inspect } from 'util';

// connection: 4,
// transaction: 5,
// task: 6,
// connection: "magenta",
// transaction: "blue",
// task: "cyan",

const logLevels = {
  levels: {
    critical: 0,
    error: 1,
    warning: 2,
    info: 3,
    debug: 4,
  },
  colors: {
    critical: "bold black redBG",
    error: "red",
    warning: "yellow",
    info: "green",
    debug: "grey",
  },
};

const defaultTransports: transport[] = [
  new DailyRotateFile({
    level: 'error',
    filename: __logPath + '/spendit-error-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d'
  }),
  new DailyRotateFile({
    level: 'info',
    filename: __logPath + '/spendit-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d'
  }),
]

addColors(logLevels.colors);
console.log("ENV LOG_LEVEL:", process.env.LOG_LEVEL);

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'debug',
  levels: logLevels.levels,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    // format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: {
    section: 'main',
    label: '',
  },
  transports: defaultTransports
}) as Logger & Record<keyof typeof logLevels['levels'], LeveledLogMethod>;


if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    level: 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.printf(({ level, message, timestamp, label, section }) => {
        // (section:label)[level]: message
        
        // Create section label string
        let sectionLabel = '';
        if (section || label) {
          sectionLabel = section;
          if (label) {
            sectionLabel += `:${label}`;
          }
        }

        if (sectionLabel.length > 0) {
          sectionLabel = `(${sectionLabel})`;
        }

        const msg = (typeof message === 'object') ? inspect(message, { colors: true, depth: 5 }) : message;

        return `${timestamp} [${level}]${sectionLabel}: ${msg}`;
      }),
    ),
  }));
}

export default logger;