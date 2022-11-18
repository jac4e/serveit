import { addColors, createLogger, format, LeveledLogMethod, Logger, transports } from 'winston';

const logLevels = {
    levels: { critical: 0, error: 1, warning: 2, debug: 3, info: 4, connection: 5, transaction: 6 },
    colors: {
      critical: "bold black redBG",
      error: "red",
      warning: "yellow",
      info: "green",
      debug: "grey",
      connection: "magenta",
      transaction: "hidden"
    },
  };

addColors(logLevels.colors);

const logger = createLogger({
  level: 'transaction',
  levels: logLevels.levels,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'serveit' },
  transports: [
    //
    // - Write to all logs with level `info` and below to `quick-start-combined.log`.
    // - Write all logs error (and below) to `quick-start-error.log`.
    //
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
}) as Logger & Record<keyof typeof logLevels['levels'], LeveledLogMethod>;

//
// If we're not in production then **ALSO** log to the `console`
// with the colorized simple format.
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  }));
}

export default logger;