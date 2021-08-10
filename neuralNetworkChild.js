const MODULE_NAME = "tncChild";
let PF = "NNC";

import packageJson from "./package.json";
const APP_VERSION = packageJson.version || null;

const DEFAULT_FORCE_LOAD_TRAINING_SET = false;
const DEFAULT_MAX_FRIENDS = 10000;
const DEFAULT_SKIP_DATABASE_HOST_LOAD_FOLDER = false;
const TEST_MODE_LENGTH = 1000;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const DEFAULT_SEND_QUEUE_INTERVAL = 100;
const DEFAULT_LOAD_USERS_FOLDER_ON_START = true;
const DEFAULT_LOAD_USER_FILE_INTERVAL = 10;

const DEFAULT_MAX_NETWORK_JSON_SIZE_MB = 15;
const DEFAULT_NEATAPTIC_HIDDEN_LAYER_SIZE = 9;

let childNetworkObj; // this is the common, default nn object

import os from "os";
import fs from "fs-extra";
import _ from "lodash";
import omit from "object.omit";
import path from "path";
import empty from "is-empty";

let hostname = os.hostname();
if (hostname.startsWith("mbp3")) {
  hostname = "mbp3";
}
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const DDPF = `${hostname.toUpperCase()} | ${PF}`;

import StatsD from "hot-shots";
const dogstatsd = new StatsD();

dogstatsd.increment("nnc.starts");
dogstatsd.event(`${DDPF} | START`, `APP_VERSION: ${APP_VERSION}`);

const MODULE_ID = PF + "_" + hostname;

const DEFAULT_NETWORK_TECHNOLOGY = "tensorflow";
const DEFAULT_BINARY_MODE = true;
const DEFAULT_TEST_RATIO = 0.25;
const QUIT_WAIT_INTERVAL = ONE_SECOND;
const DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME = 2 * ONE_HOUR;

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
} else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

let mongooseDb;
import mgt from "@threeceelabs/mongoose-twitter";
global.wordAssoDb = mgt;

const mguAppName = "MGU_" + MODULE_ID;
import { MongooseUtilities } from "@threeceelabs/mongoose-utilities";
const mgUtils = new MongooseUtilities(mguAppName);

mgUtils.on("ready", async () => {
  console.log(`${PF} | +++ MONGOOSE UTILS READY: ${mguAppName}`);
});

let configuration = {};
configuration.childId = PF;
configuration.forceLoadTrainingSet = DEFAULT_FORCE_LOAD_TRAINING_SET;
configuration.maxFriends = DEFAULT_MAX_FRIENDS;
configuration.skipDatabaseHostLoadFolder =
  DEFAULT_SKIP_DATABASE_HOST_LOAD_FOLDER;
configuration.defaultLoadUserFileInterval = DEFAULT_LOAD_USER_FILE_INTERVAL;
configuration.loadUsersFolderOnStart = DEFAULT_LOAD_USERS_FOLDER_ON_START;
configuration.testMode = false;
configuration.verbose = false;
configuration.dataSetPrepMaxParallel = 32;
configuration.parallelLoadMax = 16;
configuration.updateDbUser = false; // updates user in db from training set
configuration.equalCategoriesFlag = false;
configuration.userCharCountScreenName = 15;
configuration.userCharCountName = 50;
configuration.userCharCountDescription = 160;
configuration.userCharCountLocation = 30;

configuration.maxNetworkJsonSizeMB = DEFAULT_MAX_NETWORK_JSON_SIZE_MB;
configuration.userArchiveFileExistsMaxWaitTime =
  DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME;
configuration.testSetRatio = DEFAULT_TEST_RATIO;
configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.neatapticHiddenLayerSize = DEFAULT_NEATAPTIC_HIDDEN_LAYER_SIZE;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;

const tensorflowEvolveOptionsPickArray = [
  "callbacks",
  "hiddenLayerSize",
  "inputActivation",
  "outputActivation",
  "epochs",
  "iterations",
  "batchSize",
];

const neatapticEvolveOptionsPickArray = [
  "cost",
  "crossover",
  "elitism",
  "equal",
  "error",
  "growth",
  "iterations",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "network",
  "popsize",
  "provenance",
  "schedule",
  "selection",
  "threads",
];

const carrotEvolveOptionsPickArray = [
  "cost",
  "crossover",
  "efficientMutation",
  "elitism",
  "equal",
  "error",
  "fitness",
  "fitnessPopulation",
  "growth",
  "iterations",
  // "maxNodes",
  "maxConns",
  "maxGates",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "network",
  "popsize",
  "populationSize",
  "provenance",
  "schedule",
  "selection",
  "threads",
];

import ThreeceeUtilities from "@threeceelabs/threecee-utilities";
const tcUtils = new ThreeceeUtilities("NNC_TCU");

const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;
const formatBoolean = tcUtils.formatBoolean;

import { NeuralNetworkTools } from "@threeceelabs/neural-network-tools";
const nnTools = new NeuralNetworkTools("NNC_NNT");

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";
const DATABASE_HOST = process.env.DATABASE_HOST || "mms3";
const HOST =
  hostname === PRIMARY_HOST || hostname === DATABASE_HOST ? "default" : "local";

console.log("=========================================");
console.log("=========================================");
console.log("MODULE_NAME:  " + MODULE_NAME);
console.log("PRIMARY_HOST: " + PRIMARY_HOST);
console.log("HOST:         " + HOST);
console.log("HOST NAME:    " + hostname);
console.log("=========================================");
console.log("=========================================");

//=========================================================================
// MODULE REQUIRES
//=========================================================================
import neataptic from "neataptic";
import carrot from "@liquid-carrot/carrot/src/index.js";

import moment from "moment";
import pick from "object.pick";
import debug from "debug";
import util from "util";
import deepcopy from "deep-copy";
import async from "async";

import chalk from "chalk";
const chalkBlueBold = chalk.blue.bold;
const chalkGreenBold = chalk.green.bold;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkWarn = chalk.red;

//=========================================================================
// HOST
//=========================================================================
const configDefaultFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/default"
);

const configHostFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility",
  hostname
);

configuration.archiveFileUploadCompleteFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.local = {};
configuration.local.trainingSetsFolder = path.join(
  configHostFolder,
  "trainingSets"
);
configuration.local.userArchiveFolder = path.join(
  configHostFolder,
  "trainingSets/users"
);

configuration.default = {};
configuration.default.trainingSetsFolder = path.join(
  configDefaultFolder,
  "trainingSets"
);
configuration.default.userArchiveFolder = path.join(
  configDefaultFolder,
  "trainingSets/users"
);

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = path.join(
  configuration[HOST].trainingSetsFolder,
  "users"
);
configuration.userArchiveFolder = configuration[HOST].userArchiveFolder;
configuration.userTempArchiveFolder = configuration[HOST].userTempArchiveFolder;
configuration.userArchivePath = configuration[HOST].userArchivePath;
configuration.userTempArchivePath = configuration[HOST].userTempArchivePath;

let preppedTrainingSet = [];
let preppedTestSet = [];
let trainingSetObj = {};
let testSetObj = {};

//=========================================================================
// STATS
//=========================================================================

const startTimeMoment = moment();

const statsObj = {};

statsObj.archiveFlagObj = {};

statsObj.loadUsersFolderBusy = false;
statsObj.trainingSetReady = false;

statsObj.trainingSet = {};
statsObj.trainingSet.total = 0;

let statsObjSmall = {};

statsObj.users = {};
statsObj.users.files = {};
statsObj.users.files.added = 0;
statsObj.users.files.changed = 0;
statsObj.users.files.deleted = 0;
statsObj.users.grandTotal = 0;
statsObj.users.notCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.notInDb = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.users.processed = {};
statsObj.users.processed.total = 0;
statsObj.users.processed.percent = 0;
statsObj.users.processed.empty = 0;
statsObj.users.processed.errors = 0;
statsObj.users.processed.elapsed = 0;
statsObj.users.processed.rate = 0;
statsObj.users.processed.remain = 0;
statsObj.users.processed.remainMS = 0;
statsObj.users.processed.startMoment = 0;
statsObj.users.processed.endMoment = moment();

statsObj.pid = process.pid;
statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();

statsObj.usersFolderLoaded = false;

statsObj.status = "START";

statsObj.queues = {};

statsObj.evolve = {};
statsObj.evolve.options = {};
statsObj.evolve.startTime = moment().valueOf();
statsObj.evolve.endTime = moment().valueOf();
statsObj.evolve.elapsed = 0;

statsObj.training = {};
statsObj.training.startTime = moment();
statsObj.training.testRunId = "";
statsObj.training.seedNetworkId = false;
statsObj.training.seedNetworkRes = 0;
statsObj.training.iterations = 0;

statsObj.inputsId = "";
statsObj.outputs = [];

const statsPickArray = ["pid", "startTime", "elapsed", "elapsedMS", "status"];

//=========================================================================
// PROCESS EVENT HANDLERS
//=========================================================================

process.title = MODULE_ID.toLowerCase() + "_node_" + process.pid;

process.on("exit", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS EXIT" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "PARENT EXIT" });
});

process.on("close", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS CLOSE" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "PARENT CLOSE" });
});

process.on("disconnect", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS DISCONNECT" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  process.exit(1);
});

process.on("SIGHUP", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS SIGHUP" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "PARENT SIGHUP" });
});

process.on("SIGINT", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS SIGINT" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "PARENT SIGINT" });
});

process.on("unhandledRejection", function (err, promise) {
  console.trace(
    PF + " | *** Unhandled rejection (promise: ",
    promise,
    ", reason: ",
    err,
    ")."
  );
  quit("unhandledRejection");
  process.exit(1);
});

const trainingSetUsersSet = {};
trainingSetUsersSet.left = new Set();
trainingSetUsersSet.neutral = new Set();
trainingSetUsersSet.right = new Set();

function initConfig(cnf) {
  return new Promise(function (resolve, reject) {
    statsObj.status = "INIT CONFIG";

    if (debug.enabled) {
      console.log(
        "\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n"
      );
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = process.env.TEST_MODE === "true" ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;

    if (process.env.QUIT_ON_COMPLETE === "false") {
      cnf.quitOnComplete = false;
    } else if (
      process.env.QUIT_ON_COMPLETE === true ||
      process.env.QUIT_ON_COMPLETE === "true"
    ) {
      cnf.quitOnComplete = true;
    }

    try {
      const configArgs = Object.keys(cnf);

      configArgs.forEach(function (arg) {
        if (_.isObject(cnf[arg])) {
          console.log(
            PF + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(cnf[arg])
          );
        } else {
          console.log(PF + " | _FINAL CONFIG | " + arg + ": " + cnf[arg]);
        }
      });

      resolve(cnf);
    } catch (err) {
      console.log(chalkError(PF + " | *** CONFIG LOAD ERROR: " + err));
      reject(err);
    }
  });
}

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================

function getElapsedTimeStamp() {
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function showStats(options) {
  statsObj.elapsed = getElapsedTimeStamp();

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    console.log(PF + " | STATS\n" + jsonPrint(statsObjSmall));
  } else {
    console.log(
      chalkLog(
        PF +
          " | STATUS" +
          " | FSM: " +
          fsm.getMachineState() +
          " | START: " +
          statsObj.startTime +
          " | NOW: " +
          getTimeStamp() +
          " | ELAPSED: " +
          statsObj.elapsed
      )
    );
  }
}

//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals() {
  return new Promise(function (resolve, reject) {
    try {
      [...intervalsSet].forEach(function (intervalHandle) {
        clearInterval(intervalHandle);
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function processSend(message) {
  return new Promise(function (resolve, reject) {
    if (configuration.verbose) {
      console.log(
        chalkGreen(
          PF +
            " [" +
            processSendQueue.length +
            "]" +
            " | >T MESSAGE | " +
            getTimeStamp() +
            " | OP: " +
            message.op
        )
      );
    }

    try {
      process.send(message);
    } catch (err) {
      return reject(err);
    }

    resolve();
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

function readyToQuit() {
  const flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {
  dogstatsd.increment("tnn.quits");
  dogstatsd.event(`${DDPF} | QUIT`, opts);

  const options = opts || {};

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  fsm.fsm_exit();

  if (options) {
    console.log(PF + " | QUIT INFO\n" + jsonPrint(options));
  }

  showStats(true);

  await processSend({
    op: "QUIT",
    childId: configuration.childId,
    fsmStatus: statsObj.fsmStatus,
  });

  setInterval(async function () {
    if (readyToQuit()) {
      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(PF + " | *** FORCE QUIT"));
      } else {
        console.log(
          chalkBlueBold(PF + " | ALL PROCESSES COMPLETE ... QUITTING")
        );
      }

      if (!mongooseDb) {
        process.exit();
      } else {
        setTimeout(function () {
          mongooseDb.close(async function () {
            console.log(
              chalkBlue(
                PF +
                  " | ==========================\n" +
                  PF +
                  " | MONGO DB CONNECTION CLOSED\n" +
                  PF +
                  " | ==========================\n"
              )
            );

            process.exit();
          });
        }, 1000);
      }
    }
  }, QUIT_WAIT_INTERVAL);
}

function updateTrainingSet(p) {
  console.log(chalkBlue(PF + " | UPDATE TRAINING SET"));

  const params = p || {};

  const equalCategoriesFlag =
    params.equalCategoriesFlag !== undefined
      ? params.equalCategoriesFlag
      : configuration.equalCategoriesFlag;

  return new Promise(function (resolve, reject) {
    try {
      trainingSetObj = {};
      trainingSetObj.meta = {};
      trainingSetObj.meta.runId = statsObj.archiveFlagObj.runId;
      trainingSetObj.meta.numInputs = 0;
      trainingSetObj.meta.numOutputs = 3;
      trainingSetObj.meta.setSize = 0;
      trainingSetObj.nodeIdArray = [];

      testSetObj = {};
      testSetObj.meta = {};
      testSetObj.meta.numInputs = 0;
      testSetObj.meta.numOutputs = 3;
      testSetObj.meta.setSize = 0;
      testSetObj.nodeIdArray = [];

      const minCategorySize = Math.min(
        trainingSetUsersSet.left.size,
        trainingSetUsersSet.neutral.size,
        trainingSetUsersSet.right.size
      );

      async.eachSeries(
        ["left", "neutral", "right"],
        function (category, cb) {
          const categorySize = equalCategoriesFlag
            ? minCategorySize
            : trainingSetUsersSet[category].size;

          const trainingSetSize = parseInt(
            (1 - configuration.testSetRatio) * categorySize
          );
          const testSetSize = parseInt(
            configuration.testSetRatio * categorySize
          );

          console.log(
            chalkLog(
              PF +
                " | UPDATE TRAINING SET | " +
                category.toUpperCase() +
                " | trainingSetSize: " +
                trainingSetSize +
                " | testSetSize: " +
                testSetSize
            )
          );

          const shuffledTrainingSetNodeIdArray = _.shuffle([
            ...trainingSetUsersSet[category],
          ]);

          const trainingSetNodeIdArray = shuffledTrainingSetNodeIdArray.slice(
            0,
            trainingSetSize
          );
          const testSetNodeIdArray = shuffledTrainingSetNodeIdArray.slice(
            trainingSetSize,
            trainingSetSize + testSetSize
          );

          trainingSetObj.nodeIdArray = trainingSetObj.nodeIdArray.concat(
            trainingSetNodeIdArray
          );
          testSetObj.nodeIdArray =
            testSetObj.nodeIdArray.concat(testSetNodeIdArray);

          console.log(
            chalkLog(
              PF +
                " | TRAINING SET" +
                " | " +
                category.toUpperCase() +
                " | EQ CATEGORIES FLAG: " +
                equalCategoriesFlag +
                " | MIN CAT SIZE: " +
                minCategorySize +
                " | CAT SIZE: " +
                categorySize +
                " | TRAIN SIZE: " +
                trainingSetSize +
                " | TEST SIZE: " +
                testSetSize +
                " | TRAIN SET DATA SIZE: " +
                trainingSetObj.nodeIdArray.length
            )
          );

          cb();
        },
        function (err) {
          if (err) {
            console.log(
              chalkError(PF + " | *** UPDATE TRAINING SET ERROR: " + err)
            );
            return reject(err);
          }

          if (trainingSetObj.nodeIdArray.length === 0) {
            console.log(
              chalkError(
                PF +
                  " | *** EMPTY TRAINING SET | SIZE: " +
                  trainingSetObj.nodeIdArray.length
              )
            );
            return reject(err);
          }

          trainingSetObj.nodeIdArray = _.shuffle(trainingSetObj.nodeIdArray);
          testSetObj.nodeIdArray = _.shuffle(testSetObj.nodeIdArray);

          trainingSetObj.meta.setSize = trainingSetObj.nodeIdArray.length;
          testSetObj.meta.setSize = testSetObj.nodeIdArray.length;

          if (nnTools.getNormalization()) {
            console.log(
              chalkLog(
                PF +
                  " | NORMALIZATION\n" +
                  jsonPrint(nnTools.getNormalization())
              )
            );
          }

          console.log(
            chalkLog(
              PF +
                " | TRAINING SET | SIZE: " +
                trainingSetObj.meta.setSize +
                " | TEST SIZE: " +
                testSetObj.meta.setSize
            )
          );

          resolve();
        }
      );
    } catch (err) {
      console.log(chalkError(PF + " | *** updateTrainingSet ERROR:", err));
      reject(err);
    }
  });
}

function isValidUser(user) {
  if (!user || user === undefined || user === {} || typeof user !== "object") {
    return false;
  }
  if (!user.screenName || user.screenName === undefined) {
    return false;
  }
  if (/[^\d]/.test(user.nodeId)) {
    return false;
  }
  return true;
}

async function cursorDataHandler(user) {
  if (!isValidUser(user)) {
    console.log(
      chalkWarn(PF + " | !!! INVALID USER ... SKIPPING\n" + jsonPrint(user))
    );
    statsObj.users.processed.errors += 1;
    return;
  }

  if (
    empty(user.friends) &&
    empty(user.profileHistograms) &&
    empty(user.tweetHistograms)
  ) {
    statsObj.users.processed.empty += 1;

    if (statsObj.users.processed.empty % 100 === 0) {
      console.log(
        chalkWarn(
          PF +
            " | --- EMPTY HISTOGRAMS" +
            " | SKIPPING" +
            " | PRCSD/REM/MT/ERR/TOT: " +
            statsObj.users.processed.total +
            "/" +
            statsObj.users.processed.remain +
            "/" +
            statsObj.users.processed.empty +
            "/" +
            statsObj.users.processed.errors +
            "/" +
            statsObj.users.grandTotal +
            " | @" +
            user.screenName
        )
      );
    }
    return;
  }

  if (!user.friends || user.friends === undefined) {
    user.friends = [];
  }

  trainingSetUsersSet[user.category].add(user.nodeId);

  categorizedUsers[user.category] += 1;
  statsObj.categorizedCount += 1;

  // statsObj.users.processed.total += 1;

  if (statsObj.categorizedCount > 0 && statsObj.categorizedCount % 1000 === 0) {
    console.log(
      chalkInfo(
        PF +
          " | cursorDataHandler" +
          " | CATEGORIZED: " +
          statsObj.categorizedCount +
          " | L: " +
          categorizedUsers.left +
          " | N: " +
          categorizedUsers.neutral +
          " | R: " +
          categorizedUsers.right
      )
    );
  }

  categorizedUsers[user.category] += 1;
  statsObj.categorizedCount += 1;

  if (statsObj.categorizedCount > 0 && statsObj.categorizedCount % 100 === 0) {
    console.log(
      chalkInfo(
        PF +
          " | CATEGORIZED: " +
          statsObj.categorizedCount +
          " | L: " +
          categorizedUsers.left +
          " | N: " +
          categorizedUsers.neutral +
          " | R: " +
          categorizedUsers.right +
          " | +: " +
          categorizedUsers.positive +
          " | -: " +
          categorizedUsers.negative +
          " | 0: " +
          categorizedUsers.none
      )
    );
  }

  return;
}

async function cursorDataHandlerPromise(user) {
  try {
    await cursorDataHandler(user);

    statsObj.users.processed.total += 1;
    statsObj.users.processed.elapsed =
      moment().valueOf() - statsObj.users.processed.startMoment.valueOf(); // mseconds
    statsObj.users.processed.rate =
      statsObj.users.processed.total > 0
        ? statsObj.users.processed.elapsed / statsObj.users.processed.total
        : 0; // msecs/usersArchived
    statsObj.users.processed.remain =
      statsObj.users.grandTotal -
      (statsObj.users.processed.total + statsObj.users.processed.errors);
    statsObj.users.processed.remainMS =
      statsObj.users.processed.remain * statsObj.users.processed.rate; // mseconds
    statsObj.users.processed.endMoment = moment();
    statsObj.users.processed.endMoment.add(
      statsObj.users.processed.remainMS,
      "ms"
    );
    statsObj.users.processed.percent =
      (100 * (statsObj.users.notCategorized + statsObj.users.processed.total)) /
      statsObj.users.grandTotal;

    if (statsObj.users.processed.total % 1000 === 0) {
      console.log(
        chalkLog(`${PF} | USERS PROCESSED: ${statsObj.users.processed.total}`)
      );
    }

    return;
  } catch (err) {
    console.log(
      chalkError(PF + " | *** cursorDataHandlerPromise ERROR: " + err)
    );
  }
}

const categorizedUsers = {};

async function loadTrainingSetUsersFromDb(p) {
  const params = p || {};

  const append = params.append || false;

  statsObj.status = "LOAD TRAINING SET FROM DB";
  statsObj.trainingSetReady = false;

  if (!append) {
    statsObj.categorizedCount = 0;

    categorizedUsers.left = 0;
    categorizedUsers.neutral = 0;
    categorizedUsers.right = 0;
  }

  const query = params.query || {
    category: { $in: ["left", "right", "neutral"] },
  };

  const batchSize = params.batchSize || 1000;
  const cursorParallel = params.cursorParallel || 8;
  const limit = params.limit || 1000;

  let cursor;

  const session = await mongooseDb.startSession();

  debug("MONGO DB SESSION\n" + session.id);

  console.log(
    chalkBlue(
      PF +
        " | LOADING TRAINING SET FROM DB ..." +
        " | batchSize: " +
        batchSize +
        " | cursorParallel: " +
        cursorParallel +
        " | query\n" +
        jsonPrint(query)
    )
  );

  if (configuration.testMode) {
    cursor = global.wordAssoDb.User.find(query, { timeout: false })
      .lean()
      .batchSize(batchSize)
      .limit(limit)
      .session(session)
      .cursor()
      .addCursorFlag("noCursorTimeout", true);
  } else {
    cursor = global.wordAssoDb.User.find(query, { timeout: false })
      .lean()
      .batchSize(batchSize)
      .session(session)
      .cursor()
      .addCursorFlag("noCursorTimeout", true);
  }

  cursor.on("end", function () {
    console.log(
      chalkAlert(PF + " | --- loadTrainingSetUsersFromDb CURSOR END")
    );
  });

  cursor.on("error", function (err) {
    console.log(
      chalkError(
        PF + " | *** ERROR loadTrainingSetUsersFromDb: CURSOR ERROR: " + err
      )
    );
    throw err;
  });

  cursor.on("close", function () {
    console.log(
      chalkAlert(PF + " | XXX loadTrainingSetUsersFromDb CURSOR CLOSE")
    );
  });

  await cursor.eachAsync(
    async function (user) {
      await cursorDataHandlerPromise(user);
      return;
    },
    { parallel: cursorParallel }
  );

  statsObj.trainingSet.total =
    trainingSetUsersSet.left.size +
    trainingSetUsersSet.neutral.size +
    trainingSetUsersSet.right.size;

  console.log(
    chalkBlueBold(
      PF +
        " | +++ LOAD TRAINING SET FROM DB COMPLETE" +
        " | SET SIZE - TOTAL: " +
        statsObj.trainingSet.total +
        " / L: " +
        trainingSetUsersSet.left.size +
        " / N: " +
        trainingSetUsersSet.neutral.size +
        " / R: " +
        trainingSetUsersSet.right.size
    )
  );

  return;
}

async function loadTrainingSet(p) {
  try {
    const params = p || {};
    const verbose =
      params.verbose !== undefined ? params.verbose : configuration.verbose;

    console.log(
      chalkLog(
        PF +
          " | loadTrainingSet | LOAD TRAINING SET + NORMALIZATION" +
          " | VERBOSE: " +
          verbose
      )
    );

    statsObj.status = "LOAD TRAINING SET";
    statsObj.trainingSetReady = false;

    console.log(
      chalkLog(
        PF +
          " | loadTrainingSet | LOAD NORMALIZATION" +
          " | " +
          configuration.trainingSetsFolder +
          "/normalization.json"
      )
    );

    const filePath = path.join(
      configuration.trainingSetsFolder,
      "normalization.json"
    );

    const normalization = await fs.readJson(filePath);

    if (normalization) {
      console.log(
        chalk.black.bold(PF + " | loadTrainingSet | SET NORMALIZATION ...")
      );

      await nnTools.setNormalization(normalization);
    } else {
      console.log(
        chalkAlert(
          PF +
            " | loadTrainingSet | !!! NORMALIZATION NOT LOADED" +
            " | " +
            configuration.trainingSetsFolder +
            "/normalization.json"
        )
      );
    }

    console.log(
      chalk.black.bold(
        PF + " | loadTrainingSet | LOAD TRAINING SET USERS FROM DB"
      )
    );

    for (const category of ["left", "neutral", "right"]) {
      await loadTrainingSetUsersFromDb({
        append: true,
        query: { category: category },
      });
    }

    console.log(
      chalk.black.bold(PF + " | loadTrainingSet | UPDATE TRAINING SET")
    );

    await updateTrainingSet();

    statsObj.loadUsersFolderBusy = false;
    statsObj.trainingSetReady = true;
    console.log(chalkGreenBold(PF + " | TRAINING SET LOADED"));

    return;
  } catch (err) {
    console.log(
      chalkError(PF + " | *** USERS TRAINING SET LOAD ERROR: " + err)
    );
    statsObj.loadUsersFolderBusy = false;
    statsObj.trainingSetReady = false;
    throw err;
  }
}

async function testNetworkData(params) {
  const testSet = params.testSet;

  const convertDatumFlag =
    params.convertDatumFlag !== undefined ? params.convertDatumFlag : false;
  const userProfileOnlyFlag =
    params.userProfileOnlyFlag !== undefined
      ? params.userProfileOnlyFlag
      : configuration.userProfileOnlyFlag;
  const useDatumCacheFlag =
    params.useDatumCacheFlag !== undefined ? params.useDatumCacheFlag : true;
  const verbose = params.verbose || false;

  let numTested = 0;
  let numPassed = 0;
  let successRate = 0;

  const defaultActiveParams = {
    convertDatumFlag: convertDatumFlag,
    useDatumCacheFlag: useDatumCacheFlag,
    userProfileOnlyFlag: userProfileOnlyFlag,
    verbose: verbose,
  };

  for (const dataObj of testSet) {
    const activateParams = Object.assign({}, defaultActiveParams, {
      dataObj: dataObj,
    });

    let testOutput;

    try {
      testOutput = await nnTools.activateSingleNetwork(activateParams);
    } catch (err) {
      console.log(chalkError(PF + " | TEST NN ERROR " + "\n" + jsonPrint(err)));
      throw err;
    }

    numTested += 1;

    let match = "FAIL";
    let currentChalk = chalkAlert;

    if (testOutput.categoryAuto === dataObj.user.category) {
      match = "PASS";
      numPassed += 1;
      currentChalk = chalkGreenBold;
    }

    successRate = (100 * numPassed) / numTested;

    if (
      configuration.testMode ||
      (configuration.verbose && numTested % 10 === 0) ||
      numTested % 100 === 0
    ) {
      console.log(
        currentChalk(
          PF +
            " | TESTING" +
            " | " +
            successRate.toFixed(2) +
            "%" +
            " | " +
            numPassed +
            "/" +
            numTested +
            " | CAT M: " +
            dataObj.user.category[0].toUpperCase() +
            " A: " +
            testOutput.categoryAuto[0].toUpperCase() +
            " | MATCH: " +
            match +
            " | @" +
            dataObj.user.screenName
        )
      );
    }
  }

  const testResults = {
    testSetId: testSetObj.meta.testSetId,
    numTests: numTested,
    numPassed: numPassed,
    successRate: successRate,
  };

  console.log(
    chalkBlueBold(
      "\n================================================\n" +
        PF +
        " | TEST COMPLETE" +
        " | " +
        numPassed +
        "/" +
        testSetObj.meta.setSize +
        " | " +
        successRate.toFixed(2) +
        "%" +
        "\n================================================\n"
    )
  );

  return testResults;
}

async function testNetwork(p) {
  const params = p || {};

  const userProfileOnlyFlag =
    params.userProfileOnlyFlag !== undefined
      ? params.userProfileOnlyFlag
      : configuration.userProfileOnlyFlag;

  await nnTools.loadNetwork({ networkObj: childNetworkObj });
  await nnTools.setPrimaryNeuralNetwork(childNetworkObj.networkId);
  await nnTools.setBinaryMode(childNetworkObj.binaryMode);

  console.log(
    chalkBlue(
      PF +
        " | TEST NETWORK" +
        " | NETWORK ID: " +
        childNetworkObj.networkId +
        " | USER PROFILE ONLY: " +
        userProfileOnlyFlag +
        " | " +
        preppedTestSet.length +
        " TEST DATA LENGTH" +
        " | VERBOSE: " +
        params.verbose
    )
  );

  childNetworkObj.test = {};
  childNetworkObj.test.results = {};

  childNetworkObj.test.results = await testNetworkData({
    networkId: childNetworkObj.networkId,
    testSet: preppedTestSet,
    convertDatumFlag: false,
    userProfileOnlyFlag: userProfileOnlyFlag,
    binaryMode: childNetworkObj.binaryMode,
    verbose: params.verbose,
  });

  childNetworkObj.successRate = childNetworkObj.test.results.successRate;

  return;
}

let processSendQueueInterval;
const processSendQueue = [];
let processSendQueueReady = true;

function initProcessSendQueue(params) {
  const interval = params ? params.interval : DEFAULT_SEND_QUEUE_INTERVAL;

  return new Promise(function (resolve) {
    statsObj.status = "INIT PROCESS SEND QUEUE";

    clearInterval(processSendQueueInterval);

    processSendQueueInterval = setInterval(function () {
      if (processSendQueueReady && processSendQueue.length > 0) {
        processSendQueueReady = false;

        const messageObj = processSendQueue.shift();

        processSend(messageObj)
          .then(function () {
            processSendQueueReady = true;
          })
          .catch(function (err) {
            console.err("processSend ERROR: " + err);
            processSendQueueReady = true;
          });
      }
    }, interval);

    intervalsSet.add("processSendQueueInterval");

    resolve();
  });
}

function prepNetworkEvolve() {
  console.log(
    chalkBlueBold(
      PF +
        " | PREP NETWORK EVOLVE OPTIONS" +
        " | " +
        getTimeStamp() +
        " | NNID: " +
        statsObj.training.testRunId
    )
  );

  const options = childNetworkObj.evolve.options;

  console.log({ options });

  const schedStartTime = moment().valueOf();

  switch (childNetworkObj.networkTechnology) {
    case "tensorflow":
      options.epochs = options.iterations;
      options.callbacks = {};
      options.callbacks.onEpochEnd = (epoch, logs) => {
        const elapsedInt = moment().valueOf() - schedStartTime;
        const iterationRate = elapsedInt / epoch;
        const timeToComplete = iterationRate * (options.iterations - epoch);

        const error = logs.loss ? logs.loss.toFixed(5) : 999999999;

        statsObj.evolve.stats = logs;

        const sObj = {
          networkTechnology: childNetworkObj.networkTechnology,
          binaryMode: childNetworkObj.binaryMode,
          networkId: childNetworkObj.networkId,
          seedNetworkId: childNetworkObj.seedNetworkId,
          seedNetworkRes: childNetworkObj.seedNetworkRes,
          numInputs: childNetworkObj.numInputs,
          inputsId: childNetworkObj.inputsId,
          evolveStart: schedStartTime,
          evolveElapsed: elapsedInt,
          totalIterations: childNetworkObj.evolve.options.iterations,
          iteration: epoch,
          iterationRate: iterationRate,
          timeToComplete: timeToComplete,
          error: error,
          fitness: logs.acc.toFixed(5) || -Infinity,
        };

        processSendQueue.push({
          op: "EVOLVE_SCHEDULE",
          childId: configuration.childId,
          childIdShort: configuration.childIdShort,
          stats: sObj,
        });
      };
      break;

    default:
      options.schedule = {
        function: function (schedParams) {
          const elapsedInt = moment().valueOf() - schedStartTime;
          const iterationRate = elapsedInt / schedParams.iteration;
          const timeToComplete =
            iterationRate * (options.iterations - schedParams.iteration);

          const fitness = schedParams.fitness || 0;

          statsObj.evolve.stats = schedParams;

          const sObj = {
            networkTechnology: childNetworkObj.networkTechnology,
            binaryMode: childNetworkObj.binaryMode,
            networkId: childNetworkObj.networkId,
            seedNetworkId: childNetworkObj.seedNetworkId,
            seedNetworkRes: childNetworkObj.seedNetworkRes,
            numInputs: childNetworkObj.numInputs,
            inputsId: childNetworkObj.inputsId,
            evolveStart: schedStartTime,
            evolveElapsed: elapsedInt,
            totalIterations: childNetworkObj.evolve.options.iterations,
            iteration: schedParams.iteration,
            iterationRate: iterationRate,
            timeToComplete: timeToComplete,
            error: schedParams.error.toFixed(5) || Infinity,
            fitness: fitness.toFixed(5) || -Infinity,
          };

          processSendQueue.push({
            op: "EVOLVE_SCHEDULE",
            childId: configuration.childId,
            childIdShort: configuration.childIdShort,
            stats: sObj,
          });

          return { test: "hey" };
        },

        iterations: 1,
      };
  }

  let finalOptions;

  if (childNetworkObj.networkTechnology === "tensorflow") {
    finalOptions = pick(options, tensorflowEvolveOptionsPickArray);
  }

  if (childNetworkObj.networkTechnology === "carrot") {
    finalOptions = pick(options, carrotEvolveOptionsPickArray);
  }

  if (childNetworkObj.networkTechnology === "neataptic") {
    finalOptions = pick(options, neatapticEvolveOptionsPickArray);
  }

  if (!empty(options.network)) {
    console.log(
      chalkBlueBold(
        PF + " | EVOLVE OPTIONS | NETWORK: " + Object.keys(options.network)
      )
    );
  }

  if (
    childNetworkObj.networkTechnology === "neataptic" &&
    options.activation !== undefined &&
    typeof options.activation === "string"
  ) {
    console.log(
      chalkBlueBold(
        PF + " | EVOLVE OPTIONS | ACTIVATION: " + options.activation
      )
    );
    finalOptions.activation = neataptic.methods.activation[options.activation];
  }

  if (
    options.selection !== undefined &&
    typeof options.selection === "string"
  ) {
    console.log(
      chalkBlueBold(PF + " | EVOLVE OPTIONS | SELECTION: " + options.selection)
    );
    finalOptions.selection = neataptic.methods.selection[options.selection];
  }

  if (options.cost !== undefined && typeof options.cost === "string") {
    console.log(
      chalkBlueBold(PF + " | EVOLVE OPTIONS | COST: " + options.cost)
    );
    finalOptions.cost = neataptic.methods.cost[options.cost];
  }

  if (options.mutation !== undefined && typeof options.mutation === "string") {
    console.log(
      chalkBlueBold(PF + " | EVOLVE OPTIONS | MUTATION: " + options.mutation)
    );
    finalOptions.mutation = neataptic.methods.mutation[options.mutation];
  }

  return finalOptions;
}

function dataSetPrep(params) {
  return new Promise(function (resolve, reject) {
    const maxParallel =
      params.maxParallel || configuration.dataSetPrepMaxParallel;
    const nodeIdArray = params.setObj.nodeIdArray; // array
    const binaryMode =
      params.binaryMode !== undefined
        ? params.binaryMode
        : configuration.binaryMode;
    const userProfileOnlyFlag =
      params.userProfileOnlyFlag !== undefined
        ? params.userProfileOnlyFlag
        : configuration.userProfileOnlyFlag;
    const dataSet = [];

    let dataConverted = 0;
    statsObj.users.notInDb = 0;

    console.log(
      chalkBlue(
        PF +
          " | DATA SET preppedOptions | DATA LENGTH: " +
          nodeIdArray.length +
          " | TECH: " +
          params.networkTechnology +
          " | USER PROFILE ONLY: " +
          formatBoolean(userProfileOnlyFlag) +
          " | BIN MODE: " +
          formatBoolean(binaryMode) +
          " | INPUTS ID: " +
          params.inputsId
      )
    );

    async.eachLimit(
      nodeIdArray,
      maxParallel,
      async function (nodeId) {
        const user = await global.wordAssoDb.User.findOne({ nodeId: nodeId })
          .lean()
          .exec();

        if (!user) {
          statsObj.users.notInDb += 1;
          console.log(
            chalkAlert(
              PF +
                " [" +
                statsObj.users.notInDb +
                "] dataSetPrep | !!! USER NOT IN DB ... SKIPPING | NID: " +
                nodeId
            )
          );
          return;
        }

        if (
          (!user.profileHistograms ||
            user.profileHistograms === undefined ||
            user.profileHistograms === {}) &&
          (!user.tweetHistograms ||
            user.tweetHistograms === undefined ||
            user.tweetHistograms === {})
        ) {
          console.log(
            chalkAlert(
              PF +
                " | dataSetPrep | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" +
                user.screenName
            )
          );
          return;
        }

        if (
          !user.profileHistograms ||
          user.profileHistograms === undefined ||
          user.profileHistograms === {}
        ) {
          console.log(
            chalkAlert(
              PF +
                " | dataSetPrep | !!! EMPTY USER PROFILE HISTOGRAMS | @" +
                user.screenName
            )
          );
          user.profileHistograms = {};
        }

        if (
          !user.tweetHistograms ||
          user.tweetHistograms === undefined ||
          user.tweetHistograms === {}
        ) {
          console.log(
            chalkAlert(
              PF +
                " | dataSetPrep | !!! EMPTY USER TWEET HISTOGRAMS | @" +
                user.screenName
            )
          );
          user.tweetHistograms = {};
        }

        const results = await tcUtils.convertDatumOneNetwork({
          primaryInputsFlag: true,
          user: user,
          inputsId: params.inputsId,
          userProfileOnlyFlag: userProfileOnlyFlag,
          binaryMode: binaryMode,
          verbose: params.verbose,
        });

        if (results.emptyFlag) {
          debug(
            chalkAlert(
              PF +
                " | !!! EMPTY CONVERTED DATUM ... SKIPPING | @" +
                user.screenName
            )
          );
          return;
        }

        dataConverted += 1;

        if (results.datum.input.length !== childNetworkObj.numInputs) {
          console.log(
            chalkError(
              PF +
                " | *** ERROR DATA SET PREP ERROR | INPUT NUMBER MISMATCH" +
                " | INPUTS NUM IN: " +
                childNetworkObj.numInputs +
                " | DATUM NUM IN: " +
                results.datum.input.length +
                " | @" +
                results.user.screenName
            )
          );
          return new Error("INPUT NUMBER MISMATCH");
        }

        if (results.datum.output.length !== 3) {
          console.log(
            chalkError(
              PF +
                " | *** ERROR DATA SET PREP ERROR" +
                " | OUTPUT NUMBER MISMATCH" +
                " | OUTPUTS NUM IN: " +
                childNetworkObj.numOutputs +
                " | DATUM NUM IN: " +
                results.datum.output.length
            )
          );
          return new Error("OUTPUT NUMBER MISMATCH");
        }

        for (const inputValue of results.datum.input) {
          if (typeof inputValue !== "number") {
            return new Error(
              "INPUT VALUE NOT TYPE NUMBER | @" +
                results.user.screenName +
                " | INPUT TYPE: " +
                typeof inputValue
            );
          }
          if (inputValue < 0) {
            return new Error(
              "INPUT VALUE LESS THAN ZERO | @" +
                results.user.screenName +
                " | INPUT TYPE: " +
                typeof inputValue
            );
          }
          if (inputValue > 1) {
            return new Error(
              "INPUT VALUE GREATER THAN ONE | @" +
                results.user.screenName +
                " | INPUT TYPE: " +
                typeof inputValue
            );
          }
        }

        for (const outputValue of results.datum.output) {
          if (typeof outputValue !== "number") {
            return new Error(
              "OUTPUT VALUE NOT TYPE NUMBER | @" +
                results.user.screenName +
                " | OUTPUT TYPE: " +
                typeof outputValue
            );
          }
          if (outputValue < 0) {
            return new Error(
              "OUTPUT VALUE LESS THAN ZERO | @" +
                results.user.screenName +
                " | OUTPUT: " +
                outputValue
            );
          }
          if (outputValue > 1) {
            return new Error(
              "OUTPUT VALUE GREATER THAN ONE | @" +
                results.user.screenName +
                " | OUTPUT: " +
                outputValue
            );
          }
        }

        dataSet.push({
          user: results.user,
          datum: {
            input: results.datum.input,
            output: results.datum.output,
          },
          inputHits: results.inputHits,
          inputMisses: results.inputMisses,
          inputHitRate: results.inputHitRate,
        });

        if (
          configuration.verbose ||
          dataConverted % 1000 === 0 ||
          (configuration.testMode && dataConverted % 100 === 0)
        ) {
          console.log(
            chalkLog(
              PF +
                " | DATA CONVERTED: " +
                dataConverted +
                "/" +
                nodeIdArray.length
            )
          );
        }

        return;
      },
      function (err) {
        if (err) {
          console.log(chalkError(PF + " | *** dataSetPrep ERROR: " + err));
          return reject(err);
        }

        resolve(dataSet);
      }
    );
  });
}

const ignoreKeyArray = [
  "architecture",
  "log",
  "hiddenLayerSize",
  "inputsId",
  "inputsObj",
  "networkTechnology",
  "runId",
  "schedule",
  "schedStartTime",
  "seedNetworkId",
  "seedNetworkRes",
  "outputs",
  "popsize",
];

const setPrepRequired = function (preppedSetsConfig) {
  if (empty(statsObj.preppedSetsConfig)) {
    console.log(
      chalkAlert(PF + " | setPrepRequired | EMPTY PREPPED SETS CONFIG")
    );
    return true;
  }

  for (const prop of preppedSetsConfigPickArray) {
    if (statsObj.preppedSetsConfig[prop] === undefined) {
      console.log(
        chalkAlert(PF + " | setPrepRequired | UNDEFINED PROP: " + prop)
      );
      return true;
    }
    if (statsObj.preppedSetsConfig[prop] !== preppedSetsConfig[prop]) {
      console.log(
        chalkAlert(
          PF +
            " | setPrepRequired | CHANGED PROP" +
            " | " +
            prop +
            " | PREV: " +
            statsObj.preppedSetsConfig[prop] +
            " | CURR: " +
            preppedSetsConfig[prop]
        )
      );
      return true;
    }
  }

  return false;
};

const preppedSetsConfigPickArray = [
  "binaryMode",
  "inputsId",
  "userProfileOnlyFlag",
];

async function evolve(params) {
  let preppedOptions;

  try {
    console.log(
      chalkLog(
        PF +
          " | PREPARE NETWORK EVOLVE" +
          " | TECH: " +
          childNetworkObj.networkTechnology +
          " | NN: " +
          childNetworkObj.networkId +
          " | SEED: " +
          childNetworkObj.seedNetworkId +
          " | IN: " +
          childNetworkObj.inputsId
      )
    );

    console.log(childNetworkObj.evolve.options);

    if (childNetworkObj.meta === undefined) {
      childNetworkObj.meta = {};
    }

    let inputsObj = await global.wordAssoDb.NetworkInputs.findOne({
      inputsId: childNetworkObj.inputsId,
    })
      .lean()
      .exec();

    if (!inputsObj) {
      const file = childNetworkObj.inputsId + ".json";

      console.log(
        chalkAlert(
          PF + " | !!! INPUTS OBJ NOT IN DB: " + childNetworkObj.inputsId
        )
      );

      const filePath = path.join(configDefaultFolder, file);

      inputsObj = await fs.readJson(filePath);

      if (!inputsObj) {
        throw new Error(
          "evolve INPUTS OBJ NOT FOUND: " + childNetworkObj.inputsId
        );
      }
    }

    childNetworkObj.numInputs = inputsObj.meta.numInputs;
    trainingSetObj.meta.numInputs = inputsObj.meta.numInputs;

    childNetworkObj.meta.userProfileOnlyFlag =
      inputsObj.meta.userProfileOnlyFlag !== undefined
        ? inputsObj.meta.userProfileOnlyFlag
        : false;

    await tcUtils.loadInputs({ inputsObj: inputsObj });
    await tcUtils.setPrimaryInputs({ inputsId: inputsObj.inputsId });

    const preppedSetsConfig = {
      binaryMode: childNetworkObj.binaryMode,
      inputsId: childNetworkObj.inputsId,
      userProfileOnlyFlag: childNetworkObj.meta.userProfileOnlyFlag,
      verbose: params.verbose,
    };

    if (setPrepRequired(preppedSetsConfig)) {
      console.log(
        chalkLog(
          PF +
            "\npreppedSetsConfig\n" +
            jsonPrint(preppedSetsConfig) +
            "\nstatsObj.preppedSetsConfig\n" +
            jsonPrint(statsObj.preppedSetsConfig)
        )
      );

      statsObj.preppedSetsConfig = {};
      statsObj.preppedSetsConfig = pick(
        preppedSetsConfig,
        preppedSetsConfigPickArray
      );

      preppedSetsConfig.setObj = trainingSetObj;
      preppedTrainingSet = await dataSetPrep(preppedSetsConfig);

      preppedSetsConfig.setObj = testSetObj;
      preppedTestSet = await dataSetPrep(preppedSetsConfig);
    }

    const childNetworkRaw = await nnTools.createNetwork({
      networkObj: childNetworkObj,
      numInputs: inputsObj.meta.numInputs,
    });

    preppedOptions = await prepNetworkEvolve();

    let evolveResults = {};

    if (childNetworkObj.networkTechnology === "tensorflow") {
      childNetworkObj.inputsId = inputsObj.inputsId;
      childNetworkObj.numInputs = inputsObj.meta.numInputs;

      console.log(
        chalkBlueBold(PF + " | ===============================================")
      );
      console.log(
        chalkBlueBold(
          PF +
            " | >>> START NETWORK EVOLVE" +
            " | TRAINING SET SIZE: " +
            preppedTrainingSet.length +
            " | ARCH: " +
            childNetworkObj.architecture +
            " | TECH: " +
            childNetworkObj.networkTechnology +
            " | NN: " +
            childNetworkObj.networkId +
            " | IN: " +
            childNetworkObj.inputsId
        )
      );
      console.log(
        chalkBlueBold(PF + " | ===============================================")
      );

      childNetworkRaw.compile({
        optimizer: "sgd",
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
      });

      const results = await nnTools.fit({
        networkId: childNetworkObj.networkId,
        options: preppedOptions,
        network: childNetworkRaw,
        trainingSet: preppedTrainingSet,
      });

      console.log(results.stats.params);

      evolveResults.threads = 1;
      evolveResults.iterations = results.stats.params.epochs;
      evolveResults.loss =
        results.stats.history.loss[results.stats.history.loss.length - 1];
      evolveResults.error =
        results.stats.history.loss[results.stats.history.loss.length - 1];
      evolveResults.accuracy =
        results.stats.history.acc[results.stats.history.acc.length - 1];
      evolveResults.stats = {
        interations: results.stats.params.epochs,
        fitness: null,
        error:
          results.stats.history.loss[results.stats.history.loss.length - 1],
      };

      childNetworkObj.network = results.network;

      childNetworkObj.networkJson = await nnTools.createJson({
        networkObj: childNetworkObj,
      });

      statsObj.evolve.endTime = moment().valueOf();
      statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
      statsObj.evolve.results = evolveResults.stats;

      childNetworkObj.evolve.results = {};
      childNetworkObj.evolve.results.iterations = evolveResults.iterations;
      childNetworkObj.evolve.results.error = evolveResults.error;
      childNetworkObj.evolve.results.accuracy = evolveResults.accuracy;
      childNetworkObj.evolve.results.fitness = evolveResults.accuracy;

      childNetworkObj.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.startTime = statsObj.evolve.startTime;
      childNetworkObj.evolve.endTime = statsObj.evolve.endTime;
    } else {
      if (childNetworkObj.networkTechnology === "carrot") {
        preppedOptions.population_size = preppedOptions.populationSize;
        preppedOptions.mutation_rate = preppedOptions.mutationRate;
        preppedOptions.mutation_amount = preppedOptions.mutationAmount;
        preppedOptions.fitness_population = preppedOptions.fitnessPopulation;
      }

      console.log(
        chalkBlueBold(PF + " | ===============================================")
      );
      console.log(
        chalkBlueBold(
          PF +
            " | >>> START NETWORK EVOLVE" +
            " | TRAINING SET SIZE: " +
            preppedTrainingSet.length +
            " | ARCH: " +
            childNetworkObj.architecture +
            " | TECH: " +
            childNetworkObj.networkTechnology +
            " | NN: " +
            childNetworkObj.networkId +
            " | IN: " +
            childNetworkObj.inputsId
        )
      );
      console.log(
        chalkBlueBold(PF + " | ===============================================")
      );

      // evolveResults = await childNetworkRaw.evolve(preppedTrainingSet, preppedOptions);

      evolveResults = await nnTools.evolve({
        networkId: childNetworkObj.networkId,
        options: preppedOptions,
        network: childNetworkRaw,
        trainingSet: preppedTrainingSet,
      });

      childNetworkObj.networkJson = childNetworkRaw.toJSON();
      childNetworkObj.network = childNetworkRaw;

      evolveResults.threads = preppedOptions.threads;
      evolveResults.fitness = statsObj.evolve.stats.fitness;

      statsObj.evolve.endTime = moment().valueOf();
      statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
      statsObj.evolve.results = evolveResults;

      childNetworkObj.evolve.results = {};
      childNetworkObj.evolve.results = evolveResults;

      childNetworkObj.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.startTime = statsObj.evolve.startTime;
      childNetworkObj.evolve.endTime = statsObj.evolve.endTime;
    }

    console.log(
      chalkBlueBold(
        "=======================================================\n" +
          PF +
          " | EVOLVE COMPLETE" +
          " | " +
          configuration.childId +
          " | " +
          getTimeStamp() +
          " | TECH: " +
          childNetworkObj.networkTechnology +
          " | INPUT ID: " +
          childNetworkObj.inputsId +
          " | INPUTS: " +
          childNetworkObj.numInputs +
          // " | TIME: " + evolveResults.time +
          " | THREADS: " +
          evolveResults.threads +
          " | ITERATIONS: " +
          evolveResults.iterations +
          " | ERROR: " +
          evolveResults.error +
          " | ELAPSED: " +
          msToTime(statsObj.evolve.elapsed) +
          "\n======================================================="
      )
    );

    return;
  } catch (err) {
    console.log(chalkError(PF + " | *** EVOLVE ERROR: " + err));
    console.trace(err);
    console.log(chalkError(PF + " | *** EVOLVE ERROR: params"));
    console.log(params);
    console.log(chalkError(PF + " | *** EVOLVE ERROR: preppedOptions"));
    console.log(preppedOptions);
    throw err;
  }
}

function networkEvolve(p) {
  return new Promise(function (resolve, reject) {
    console.log(
      chalkBlueBold(PF + " | NETWORK EVOLVE | " + configuration.childId)
    );

    const params = childNetworkObj.evolve.options;
    debug({ params });

    const options = {};

    if (params.seedNetworkId) {
      params.architecture = "seed";
      params.networkTechnology = params.networkTechnology
        ? params.networkTechnology
        : "tensorflow";
      debug(chalkAlert(PF + " | START NETWORK DEFINED: " + params.networkId));
    }

    if (!params.architecture || params.architecture === undefined) {
      params.architecture = "random";
    }

    if (!params.networkTechnology || params.networkTechnology === undefined) {
      params.networkTechnology = configuration.networkTechnology;
    }

    const networkTech =
      params.networkTechnology === "carrot" ? carrot : neataptic;

    statsObj.evolve.startTime = moment().valueOf();
    statsObj.evolve.elapsed = 0;
    statsObj.evolve.stats = {};

    async.eachSeries(
      Object.keys(params),
      function (key, cb) {
        debug(">>>> KEY: " + key);

        switch (key) {
          case "networkObj":
            console.log(
              PF +
                " | " +
                configuration.childId +
                " | EVOLVE OPTION" +
                " | NN ID: " +
                key +
                ": " +
                params[key].networkId +
                " | IN: " +
                params[key].inputsId +
                " | SR: " +
                params[key].successRate.toFixed(2) +
                "%"
            );
            break;

          case "network":
            if (!empty(params.network)) {
              console.log(
                PF +
                  " | " +
                  configuration.childId +
                  " | EVOLVE OPTION | " +
                  key +
                  "\n" +
                  Object.keys(params[key])
              );
            } else {
              console.log(
                PF +
                  " | " +
                  configuration.childId +
                  " | EVOLVE OPTION | " +
                  key +
                  ": " +
                  params[key]
              );
            }
            break;

          case "mutation":
            console.log(
              PF +
                " | " +
                configuration.childId +
                " | EVOLVE OPTION | " +
                key +
                ": " +
                params[key]
            );
            options.mutation = networkTech.methods.mutation[params[key]];
            break;

          case "selection":
            console.log(
              PF +
                " | " +
                configuration.childId +
                " | EVOLVE OPTION | " +
                key +
                ": " +
                params[key]
            );
            options.selection = networkTech.methods.selection[params[key]];
            break;

          case "cost":
            console.log(
              PF +
                " | " +
                configuration.childId +
                " | EVOLVE OPTION | " +
                key +
                ": " +
                params[key]
            );
            options.cost = networkTech.methods.cost[params[key]];
            break;

          case "activation":
            console.log(
              PF +
                " | " +
                configuration.childId +
                " | EVOLVE OPTION | " +
                key +
                ": " +
                params[key]
            );
            options.activation = networkTech.methods.activation[params[key]];
            break;

          default:
            if (!ignoreKeyArray.includes(key)) {
              console.log(
                PF +
                  " | " +
                  configuration.childId +
                  " | EVOLVE OPTION | " +
                  key +
                  ": " +
                  params[key]
              );
              options[key] = params[key];
            }
        }

        cb();
      },
      async function (err) {
        try {
          if (err) {
            console.log(chalkError(PF + " | *** networkEvolve ERROR: " + err));
            return reject(err);
          }

          await evolve({ verbose: p.verbose });

          console.log(chalkGreen(PF + " | END networkEvolve"));

          resolve();
        } catch (e) {
          console.log(chalkError(PF + " | *** EVOLVE ERROR: " + e));
          return reject(e);
        }
      }
    );
  });
}

//=========================================================================
// FSM
//=========================================================================
import Stately from "stately.js";
import { config } from "process";

debug({ config });

const FSM_TICK_INTERVAL = ONE_SECOND;

let fsmTickInterval;
let fsmPreviousState = "IDLE";

statsObj.fsmState = "IDLE";

function reporter(event, oldState, newState) {
  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  dogstatsd.event(`${DDPF} | FSM | ${event}`, `${oldState} -> ${newState}`);

  console.log(
    chalkLog(
      PF +
        " | --------------------------------------------------------\n" +
        PF +
        " | << FSM >> CHILD" +
        " | " +
        configuration.childId +
        " | " +
        event +
        " | " +
        fsmPreviousState +
        " -> " +
        newState +
        "\n" +
        PF +
        " | --------------------------------------------------------"
    )
  );
}

const fsmStates = {
  RESET: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        dogstatsd.increment("nnc.fsm.reset");
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "RESET";

        await nnTools.abortFit();
        await nnTools.abortEvolve();
      }
    },

    fsm_tick: function () {},

    fsm_init: "INIT",
    fsm_idle: "IDLE",
    fsm_exit: "EXIT",
    fsm_resetEnd: "IDLE",
  },

  IDLE: {
    onEnter: function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        dogstatsd.increment("nnc.fsm.idle");
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "IDLE";
      }
    },

    fsm_tick: function () {},

    fsm_init: "INIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
  },

  EXIT: {
    onEnter: function (event, oldState, newState) {
      dogstatsd.increment("nnc.fsm.exit");
      reporter(event, oldState, newState);
      statsObj.fsmStatus = "EXIT";
    },
  },

  ERROR: {
    onEnter: async function (event, oldState, newState) {
      dogstatsd.increment("nnc.fsm.error");
      reporter(event, oldState, newState);

      statsObj.fsmStatus = "ERROR";

      await processSend({
        op: "ERROR",
        childId: configuration.childId,
        err: statsObj.error,
        fsmStatus: statsObj.fsmStatus,
      });

      if (configuration.quitOnError) {
        console.log(chalkError(PF + " | *** ERROR | QUITTING ..."));
        quit({ cause: "QUIT_ON_ERROR" });
      } else {
        console.log(chalkError(PF + " | *** ERROR | ==> READY STATE"));
        fsm.fsm_ready();
      }
    },
  },

  INIT: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        try {
          reporter(event, oldState, newState);
          dogstatsd.increment("nnc.fsm.init");
          statsObj.fsmStatus = "INIT";

          const cnf = await initConfig(configuration);
          configuration = deepcopy(cnf);

          mongooseDb = await mgUtils.connectDb();

          statsObj.status = "START";

          if (configuration.testMode) {
            dogstatsd.event(
              `${DDPF} | *** TEST MODE ***`,
              `CHILD ID: ${configuration.childId}`
            );
            configuration.trainingSetFile = "trainingSet_test.json";
            configuration.defaultUserArchiveFlagFile =
              "usersZipUploadComplete_test.json";
            console.log(chalkAlert(PF + " | TEST MODE"));
            console.log(
              chalkAlert(
                PF +
                  " | trainingSetFile:            " +
                  configuration.trainingSetFile
              )
            );
            console.log(
              chalkAlert(
                PF +
                  " | defaultUserArchiveFlagFile: " +
                  configuration.defaultUserArchiveFlagFile
              )
            );
          }

          console.log(
            chalkBlueBold(
              "\n--------------------------------------------------------" +
                "\n" +
                PF +
                " | " +
                configuration.processName +
                "\nCONFIGURATION\n" +
                jsonPrint(configuration) +
                "--------------------------------------------------------"
            )
          );

          await processSend({
            op: "STATS",
            childId: configuration.childId,
            fsmStatus: statsObj.fsmStatus,
          });
          await initProcessSendQueue();

          fsm.fsm_ready();
        } catch (err) {
          dogstatsd.increment("nnc.errors");
          console.log(PF + " | *** INIT ERROR: " + err);
          statsObj.error = err;
          fsm.fsm_error();
        }
      }
    },
    fsm_tick: function () {},
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_ready: "READY",
    fsm_reset: "RESET",
  },

  READY: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        dogstatsd.increment("nnc.fsm.ready");
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "READY";
        await processSend({
          op: "STATS",
          childId: configuration.childId,
          fsmStatus: statsObj.fsmStatus,
        });
      }
    },
    fsm_tick: function () {},
    fsm_init: "INIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
    fsm_config_evolve: "CONFIG_EVOLVE",
  },

  CONFIG_EVOLVE: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        try {
          dogstatsd.increment("nnc.fsm.configEvolve");
          reporter(event, oldState, newState);
          statsObj.fsmStatus = "CONFIG_EVOLVE";

          await processSend({
            op: "STATS",
            childId: configuration.childId,
            fsmStatus: statsObj.fsmStatus,
          });

          if (
            !statsObj.trainingSetReady ||
            configuration.forceLoadTrainingSet
          ) {
            await loadTrainingSet();
          }

          if (configuration.testMode) {
            trainingSetObj.nodeIdArray = _.shuffle(trainingSetObj.nodeIdArray);
            trainingSetObj.nodeIdArray.length = Math.min(
              trainingSetObj.nodeIdArray.length,
              TEST_MODE_LENGTH
            );
            testSetObj.nodeIdArray.length = parseInt(
              configuration.testSetRatio * trainingSetObj.nodeIdArray.length
            );
            trainingSetObj.meta.setSize = trainingSetObj.nodeIdArray.length;
            testSetObj.meta.setSize = testSetObj.nodeIdArray.length;
          }

          fsm.fsm_evolve();
        } catch (err) {
          dogstatsd.increment("nnc.errors");
          dogstatsd.event(`${DDPF} | ERROR`, `${err}`);
          console.log(chalkError(PF + " | *** CONFIG_EVOLVE ERROR: " + err));
          statsObj.error = err;
          fsm.fsm_error();
        }
      }
    },
    fsm_tick: function () {},
    fsm_init: "INIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
    fsm_evolve: "EVOLVE",
  },

  EVOLVE: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        try {
          dogstatsd.increment("nnc.fsm.evolve");

          reporter(event, oldState, newState);

          statsObj.fsmStatus = "EVOLVE";
          await processSend({
            op: "STATS",
            childId: configuration.childId,
            fsmStatus: statsObj.fsmStatus,
          });
          await networkEvolve({ verbose: configuration.verbose });
          await testNetwork({
            inputsId: childNetworkObj.inputsId,
            binaryMode: childNetworkObj.binaryMode,
            userProfileOnlyFlag: childNetworkObj.meta.userProfileOnlyFlag,
            verbose: configuration.verbose,
          });

          console.log(
            chalkLog(
              PF +
                " | ... SAVING NN TO DB: " +
                childNetworkObj.networkId +
                " | INPUTS: " +
                childNetworkObj.inputsId
            )
          );

          try {
            const childNetworkObjSmall = omit(childNetworkObj, [
              "inputsObj",
              "network",
              "networkRaw",
              "evolve.options.network",
              "evolve.options.schedule",
            ]);
            const nnDoc = new global.wordAssoDb.NeuralNetwork(
              childNetworkObjSmall
            );

            await nnDoc.save();
          } catch (err) {
            dogstatsd.increment("nnc.errors");
            dogstatsd.event(`${DDPF} | NN DB SAVE ERROR`, `ERROR: ${err}`);
            console.trace(PF + " | *** NN DB SAVE ERROR: ", err);
            throw err;
          }

          console.log(
            chalkGreen(
              PF + " | +++ ADDED NN TO DB: " + childNetworkObj.networkId
            )
          );

          const messageObj = {
            op: "EVOLVE_COMPLETE",
            childId: configuration.childId,
            networkId: childNetworkObj.networkId,
            statsObj: statsObj.evolve.results,
          };

          await processSend(messageObj);

          console.log(
            chalkLog(
              PF + " | SENT EVOLVE_COMPLETE: " + childNetworkObj.networkId
            )
          );
          fsm.fsm_evolve_complete();
        } catch (err) {
          delete childNetworkObj.inputsObj;
          delete childNetworkObj.network;
          delete childNetworkObj.networkJson;
          delete childNetworkObj.networkRaw;
          delete childNetworkObj.evolve.options.network;
          delete childNetworkObj.evolve.options.schedule;
          dogstatsd.increment("nnc.errors");
          dogstatsd.event(`${DDPF} | EVOLVE ERROR`, `ERROR: ${err}`);

          const messageObj = {
            op: "EVOLVE_ERROR",
            childId: configuration.childId,
            networkId: childNetworkObj.networkId,
            networkObj: childNetworkObj,
            err: err,
            statsObj: statsObj.evolve.results,
          };

          await processSend(messageObj);
          console.log(chalkError(PF + " | *** EVOLVE ERROR: " + err));
          console.log(
            chalkError(
              PF +
                " | *** EVOLVE ERROR\nnetworkObj.meta\n" +
                jsonPrint(childNetworkObj.meta)
            )
          );
          console.log(
            chalkError(
              PF +
                " | *** EVOLVE ERROR\ntrainingSet\n" +
                jsonPrint(trainingSetObj.meta)
            )
          );
          console.log(
            chalkError(
              PF + " | *** EVOLVE ERROR\ntestSet\n" + jsonPrint(testSetObj.meta)
            )
          );
          fsm.fsm_evolve_complete();
        }
      }
    },
    fsm_tick: function () {},
    fsm_init: "INIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_abort: "EVOLVE_COMPLETE",
    fsm_reset: "RESET",
    fsm_evolve_complete: "EVOLVE_COMPLETE",
  },

  EVOLVE_COMPLETE: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        dogstatsd.increment("nnc.fsm.evolveComplete");

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "EVOLVE_COMPLETE";

        await processSend({
          op: "STATS",
          childId: configuration.childId,
          fsmStatus: statsObj.fsmStatus,
        });

        if (configuration.quitOnComplete) {
          console.log(chalkBlueBold(PF + " | EVOLVE COMPLETE | QUITTING ..."));
          quit({ cause: "QUIT_ON_COMPLETE" });
        } else {
          console.log(chalkBlueBold(PF + " | EVOLVE COMPLETE"));
          fsm.fsm_ready();
        }
      }
    },

    fsm_tick: function () {},

    fsm_init: "INIT",
    fsm_ready: "READY",
    fsm_exit: "EXIT",
    fsm_reset: "RESET",
    fsm_error: "ERROR",
    fsm_resetEnd: "IDLE",
  },
};

const fsm = Stately.machine(fsmStates);

async function initFsmTickInterval(interval) {
  console.log(
    chalkLog(PF + " | INIT FSM TICK INTERVAL | " + msToTime(interval))
  );

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function () {
    fsm.fsm_tick();
  }, interval);

  return;
}

reporter("START", "---", fsm.getMachineState());

console.log(PF + " | =================================");
console.log(PF + " | PROCESS TITLE: " + process.title);
console.log(PF + " | HOST:          " + hostname);
console.log(PF + " | PROCESS ID:    " + process.pid);
console.log(PF + " | RUN ID:        " + statsObj.runId);
console.log(
  PF +
    " | PROCESS ARGS   " +
    util.inspect(process.argv, { showHidden: false, depth: 1 })
);
console.log(PF + " | =================================");

console.log(
  chalkBlueBold(
    "\n=======================================================================\n" +
      PF +
      " | " +
      MODULE_ID +
      " STARTED | " +
      getTimeStamp() +
      "\n=======================================================================\n"
  )
);

async function networkDefaults(nnObj) {
  try {
    if (empty(nnObj)) {
      console.trace(chalkError("networkDefaults ERROR: networkObj UNDEFINED"));
      throw new Error("networkDefaults ERROR: networkObj UNDEFINED");
    }

    if (empty(nnObj.networkTechnology)) {
      nnObj.networkTechnology = "neataptic";
    }
    if (empty(nnObj.betterChild)) {
      nnObj.betterChild = false;
    }
    if (empty(nnObj.testCycles)) {
      nnObj.testCycles = 0;
    }
    if (empty(nnObj.testCycleHistory)) {
      nnObj.testCycleHistory = [];
    }
    if (empty(nnObj.overallMatchRate)) {
      nnObj.overallMatchRate = 0;
    }
    if (empty(nnObj.runtimeMatchRate)) {
      nnObj.runtimeMatchRate = 0;
    }
    if (empty(nnObj.matchRate)) {
      nnObj.matchRate = 0;
    }
    if (empty(nnObj.successRate)) {
      nnObj.successRate = 0;
    }

    return nnObj;
  } catch (err) {
    console.log(chalkError(PF + " | *** networkDefaults ERROR: " + err));
    throw err;
  }
}

async function configNetworkEvolve(params) {
  try {
    const newNetObj = {};

    if (params.testSetRatio !== undefined) {
      configuration.testSetRatio = params.testSetRatio;
    }

    console.log(
      chalkInfo(
        PF +
          " | CONFIG EVOLVE" +
          " | CHILD ID: " +
          params.childId +
          " | ARCH: " +
          params.architecture +
          " | TECH: " +
          params.networkTechnology +
          " | IN: " +
          params.numInputs +
          " | SEED: " +
          params.seedNetworkId +
          " | SEED RES: " +
          params.seedNetworkRes +
          " | TEST SET RATIO: " +
          configuration.testSetRatio
      )
    );

    configuration.childId = params.childId;

    newNetObj.binaryMode = params.binaryMode;
    newNetObj.networkTechnology = params.networkTechnology || "neataptic";

    if (newNetObj.networkTechnology === "tensorflow") {
      nnTools.enableTensorflow();
    }

    newNetObj.networkId = params.testRunId;
    newNetObj.architecture = params.architecture;
    newNetObj.hiddenLayerSize = params.hiddenLayerSize || 0;
    newNetObj.seedNetworkId =
      params.seedNetworkId &&
      params.seedNetworkId !== undefined &&
      params.seedNetworkId !== "false"
        ? params.seedNetworkId
        : false;
    newNetObj.seedNetworkRes = params.seedNetworkRes;
    newNetObj.networkCreateMode = "evolve";
    newNetObj.testRunId = params.testRunId;
    newNetObj.inputsId = params.inputsId;
    newNetObj.numInputs = params.numInputs;
    newNetObj.numOutputs = 3;
    newNetObj.outputs = [];
    newNetObj.outputs = params.outputs;

    newNetObj.evolve = {};
    newNetObj.evolve.results = {};
    newNetObj.evolve.options = {};

    newNetObj.evolve.options = pick(params, [
      "activation",
      "architecture",
      "binaryMode",
      "clear",
      "cost",
      "efficientMutation",
      "elitism",
      "equal",
      "error",
      "errorThresh",
      "fitnessPopulation",
      "growth",
      "hiddenLayerSize",
      "inputsId",
      "inputActivation",
      "outputActivation",
      "iterations",
      "learningRate",
      "loss",
      "metrics",
      "momentum",
      "mutation",
      "mutationAmount",
      "mutationRate",
      "networkTechnology",
      "optimizer",
      "outputs",
      "popsize",
      "populationSize",
      "provenance",
      "runId",
      "seedNetworkId",
      "seedNetworkRes",
      "selection",
      "threads",
    ]);

    newNetObj.evolve.elapsed = statsObj.evolve.elapsed;
    newNetObj.evolve.startTime = statsObj.evolve.startTime;
    newNetObj.evolve.endTime = statsObj.evolve.endTime;

    if (newNetObj.evolve.options.seedNetworkId) {
      let seedNetworkObj = await global.wordAssoDb.NeuralNetwork.findOne({
        networkId: newNetObj.seedNetworkId,
      }).exec();

      if (!seedNetworkObj || seedNetworkObj === undefined) {
        console.log(
          chalkAlert(
            PF +
              " | !!! SEED NETWORK NOT FOUND IN DB ... CHECK FOR FILE" +
              " | SEED: " +
              newNetObj.seedNetworkId
          )
        );

        const file = newNetObj.seedNetworkId + ".json";
        const filePath = path.join(
          "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/best/neuralNetworks",
          file
        );

        seedNetworkObj = await fs.readJson(filePath);
      }

      if (
        seedNetworkObj &&
        seedNetworkObj.networkTechnology !== newNetObj.networkTechnology
      ) {
        console.log(
          chalkAlert(
            PF +
              " | !!! CHANGE NETWORK TECH TO SEED NN TECH" +
              " | SEED: " +
              seedNetworkObj.networkTechnology +
              " --> CHILD: " +
              newNetObj.networkTechnology
          )
        );
        newNetObj.networkTechnology = seedNetworkObj.networkTechnology;
      }

      newNetObj.numInputs = seedNetworkObj.numInputs;
      newNetObj.numOutputs = seedNetworkObj.numOutputs;
      newNetObj.seedNetworkId = seedNetworkObj.networkId;
      newNetObj.seedNetworkRes = seedNetworkObj.successRate;

      if (!empty(seedNetworkObj.networkJson)) {
        newNetObj.networkJson = seedNetworkObj.networkJson;
      } else if (!empty(seedNetworkObj.network)) {
        newNetObj.networkJson = seedNetworkObj.network;
      } else {
        console.log(
          chalkError(
            PF +
              " | *** NN JSON UNDEFINED" +
              " | SEED: " +
              seedNetworkObj.networkId +
              " | TECH: " +
              seedNetworkObj.networkTechnology
          )
        );
        throw new Error("SEED NN JSON UNDEFINED: " + seedNetworkObj.networkId);
      }

      console.log(
        chalkBlueBold(
          PF +
            " | EVOLVE | " +
            getTimeStamp() +
            " | " +
            configuration.childId +
            " | " +
            newNetObj.networkId +
            " | BIN MODE: " +
            newNetObj.binaryMode +
            " | ARCH: " +
            newNetObj.architecture +
            " | TECH: " +
            newNetObj.networkTechnology +
            " | INPUTS: " +
            newNetObj.numInputs +
            " | HIDDEN: " +
            newNetObj.evolve.options.hiddenLayerSize +
            " | THREADs: " +
            newNetObj.evolve.options.threads +
            " | ITRS: " +
            newNetObj.evolve.options.iterations +
            " | SEED: " +
            newNetObj.seedNetworkId +
            " | SEED RES %: " +
            newNetObj.seedNetworkRes
        )
      );

      return newNetObj;
    } else {
      newNetObj.evolve.options.network = null;

      console.log(
        chalkBlueBold(
          PF +
            " | EVOLVE | " +
            getTimeStamp() +
            " | " +
            configuration.childId +
            " | " +
            newNetObj.networkId +
            " | BIN MODE: " +
            newNetObj.binaryMode +
            " | ARCH: " +
            newNetObj.architecture +
            " | TECH: " +
            newNetObj.networkTechnology +
            " | INPUTS: " +
            newNetObj.numInputs +
            " | HIDDEN: " +
            newNetObj.evolve.options.hiddenLayerSize +
            " | THREADs: " +
            newNetObj.evolve.options.threads +
            " | ITRS: " +
            newNetObj.evolve.options.iterations
        )
      );

      const nnObj = await networkDefaults(newNetObj);
      return nnObj;
    }
  } catch (err) {
    console.log(chalkError(PF + " | *** configNetworkEvolve ERROR: " + err));
  }
}

process.on("message", async function (m) {
  try {
    if (configuration.verbose) {
      console.log(
        chalkLog(PF + " | <R MESSAGE | " + getTimeStamp() + " | OP: " + m.op)
      );
    }

    switch (m.op) {
      case "RESET":
        console.log(chalkInfo(PF + " | RESET" + " | CHILD ID: " + m.childId));
        fsm.fsm_reset();
        break;

      case "ABORT":
        console.log(chalkInfo(PF + " | ABORT" + " | CHILD ID: " + m.childId));
        await nnTools.abortFit();
        await nnTools.abortEvolve();
        fsm.fsm_abort();
        break;

      case "VERBOSE":
        console.log(
          chalkInfo(
            PF +
              " | VERBOSE" +
              " | CHILD ID: " +
              m.childId +
              " | VERBOSE: " +
              m.verbose +
              "\n" +
              jsonPrint(m)
          )
        );
        configuration.verbose = m.verbose;
        break;

      case "INIT":
        PF = m.moduleIdPrefix || PF;

        console.log(
          chalkBlueBold(
            PF +
              " | <R INIT" +
              " | CHILD ID: " +
              m.childId +
              "\nDEFAULT CONFIGURATION\n" +
              jsonPrint(configuration) +
              "\nLOADED  CONFIGURATION\n" +
              jsonPrint(m.configuration)
          )
        );

        configuration = _.assign(configuration, m.configuration);

        if (m.loadUsersFolderOnStart !== undefined) {
          configuration.loadUsersFolderOnStart = m.loadUsersFolderOnStart;
        }
        if (m.testMode !== undefined) {
          configuration.testMode = m.testMode;
        }
        if (m.verbose !== undefined) {
          configuration.verbose = m.verbose;
        }
        if (m.testSetRatio !== undefined) {
          configuration.testSetRatio = m.testSetRatio;
        }
        if (m.binaryMode !== undefined) {
          configuration.binaryMode = m.binaryMode;
        }
        if (m.equalCategoriesFlag !== undefined) {
          configuration.equalCategoriesFlag = m.equalCategoriesFlag;
        }
        if (m.userArchiveFileExistsMaxWaitTime !== undefined) {
          configuration.userArchiveFileExistsMaxWaitTime =
            m.userArchiveFileExistsMaxWaitTime;
        }

        configuration.childId = m.childId;
        configuration.childIdShort = m.childIdShort;

        statsObj.childId = m.childId;
        statsObj.childIdShort = m.childIdShort;

        process.title = m.childId;
        process.name = m.childId;

        console.log(
          chalkBlueBold(
            PF + " | FINAL INIT CONFIGURATION" + "\n" + jsonPrint(configuration)
          )
        );

        fsm.fsm_init();
        break;

      case "READY":
        console.log(chalkInfo(PF + " | READY" + " | CHILD ID: " + m.childId));
        fsm.fsm_ready();
        break;

      case "CONFIG_EVOLVE":
        console.log(
          chalkInfo(
            `${PF} | CONFIG_EVOLVE | CHILD ID: ${m.childId} \n${jsonPrint(m)}`
          )
        );

        childNetworkObj = null;
        childNetworkObj = await configNetworkEvolve(m);

        statsObj.evolve.options = omit(childNetworkObj.evolve.options, [
          "network",
        ]);

        statsObj.training.startTime = moment().valueOf();
        statsObj.training.testRunId = m.testRunId;
        statsObj.training.seedNetworkId = m.seedNetworkId;
        statsObj.training.seedNetworkRes = m.seedNetworkRes;
        statsObj.training.iterations = m.iterations;

        statsObj.inputsId = m.inputsId;
        statsObj.outputs = [];
        statsObj.outputs = m.outputs;

        fsm.fsm_config_evolve();
        break;

      case "STATS":
        showStats();
        await processSend({
          op: "STATS",
          childId: configuration.childId,
          fsmStatus: statsObj.fsmStatus,
        });
        break;

      case "QUIT":
        quit({ cause: "PARENT QUIT" });
        break;

      case "PING":
        if (configuration.verbose) {
          console.log(
            chalkInfo(
              PF +
                " | PING" +
                " | CHILD ID: " +
                m.childId +
                " | PING ID: " +
                m.pingId
            )
          );
        }
        await processSend({
          op: "PONG",
          pingId: m.pingId,
          childId: configuration.childId,
          fsmStatus: statsObj.fsmStatus,
        });
        break;

      default:
        console.log(chalkError(PF + " | UNKNOWN OP ERROR | " + m.op));
    }
  } catch (err) {
    console.log(chalkError(PF + " | *** PROCESS ON MESSAGE ERROR: " + err));
  }
});

// !!!KLUDGE !!!BUG??? watch fucks up loading user data and I don't know why! :(
// const directoriesAdded = new Set();

setTimeout(async function () {
  try {
    await initFsmTickInterval(FSM_TICK_INTERVAL);
  } catch (err) {
    console.log(
      chalkError(PF + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err))
    );
    if (err.code !== 404) {
      quit({ cause: new Error("INIT CONFIG ERROR") });
    }
  }
}, 10);
