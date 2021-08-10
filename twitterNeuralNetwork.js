import dotenv from "dotenv";
const envConfig = dotenv.config({ path: process.env.WORD_ENV_VARS_FILE });

if (envConfig.error) {
  throw envConfig.error;
}

const MODULE_NAME = "twitterNeuralNetwork";
const PF = "TNN";
import packageJson from "./package.json";
const APP_VERSION = packageJson.version || null;

const errorLogFile = "/usr/local/var/log/tnn/error.log";
const combinedLogFile = "/usr/local/var/log/tnn/combined.log";

import winston from "winston";

const logger = winston.createLogger({
  level: "debug",
  // format: winston.format.json(),
  // defaultMeta: { service: "tnn" },
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: errorLogFile, level: "error" }),
    new winston.transports.File({ filename: combinedLogFile }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
import ddTrace from "dd-trace";
const ddTracer = ddTrace.init();

logger.info(`${PF} | +++ ENV CONFIG LOADED`);

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;

const CHILD_PREFIX = "tnc_node";
const CHILD_PREFIX_SHORT = "NC";

const TEST_MODE = false; // applies only to parent
const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = false;

const SAVE_FILE_QUEUE_INTERVAL = 5 * ONE_SECOND;
const QUIT_WAIT_INTERVAL = 5 * ONE_SECOND;
const STATS_UPDATE_INTERVAL = 5 * ONE_MINUTE;

const DEFAULT_MAX_FRIENDS = 10000;
const DEFAULT_PURGE_MIN = true; // applies only to parent
const DEFAULT_EVOLVE_TIMEOUT_DURATION = 10 * ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;
const DEFAULT_DISABLE_CREATE_TEST_SET = false;
const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 90; // percent
const DEFAULT_GLOBAL_VIABLE_SUCCESS_RATE = 90;
const DEFAULT_HOST_MIN_SUCCESS_RATE = 50; // percent
const DEFAULT_HOST_MIN_SUCCESS_RATE_MSE = 40; // Harder to past with cost === MSE
const DEFAULT_HOST_PURGE_MIN_SUCCESS_RATE = 60; // percent
const DEFAULT_INIT_MAIN_INTERVAL =
  process.env.TNN_INIT_MAIN_INTERVAL || 10 * ONE_MINUTE;
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 80; // percent
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 1;
const DEFAULT_QUIT_ON_COMPLETE = false;
const DEFAULT_SEED_RANDOMIZE_OPTIONS = false;
const DEFAULT_SEED_NETWORK_PROBABILITY = 0.5;
const DEFAULT_TEST_SET_RATIO = 0.25;
const DEFAULT_USE_LOCAL_TRAINING_SETS = false;

const DEFAULT_LOAD_ALL_INPUTS = false;
const DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY = true;
const DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY = false;
const DEFAULT_CHILD_ID_PREFIX = "tnc_node_";

import { EVOVLE_DEFAULTS } from "./config/evolveConfig.js";

import os from "os";
let hostname = os.hostname();
if (hostname.startsWith("mbp3")) {
  hostname = "mbp3";
}
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

import StatsD from "hot-shots";
const dogstatsd = new StatsD();

const DDPF = `${hostname.toUpperCase()} | ${PF}`;
dogstatsd.increment("tnn.starts");
dogstatsd.event(`${DDPF} | START`, `APP_VERSION: ${APP_VERSION}`);

import _ from "lodash";
import dotProp from "dot-prop";

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";
const DATABASE_HOST = process.env.DATABASE_HOST || "mms3";
const DEFAULT_DATA_ROOT = process.env.DATA_ROOT_FOLDER || "/Volumes/RAID1/data";

const HOST =
  hostname === PRIMARY_HOST || hostname === DATABASE_HOST ? "default" : "local";

logger.info("=========================================");
logger.info("=========================================");
logger.info("MODULE_NAME:  " + MODULE_NAME);
logger.info("VERSION:      " + APP_VERSION);
logger.info("PRIMARY_HOST: " + PRIMARY_HOST);
logger.info("HOST:         " + HOST);
logger.info("HOST NAME:    " + hostname);
logger.info("=========================================");
logger.info("=========================================");

const MODULE_ID = PF + "_node_" + hostname;

let mongooseDb;
import mgt from "@threeceelabs/mongoose-twitter";
global.wordAssoDb = mgt;

const mguAppName = "MGU_" + MODULE_ID;
import { MongooseUtilities } from "@threeceelabs/mongoose-utilities";
const mgUtils = new MongooseUtilities(mguAppName);

mgUtils.on("ready", async () => {
  logger.info(`${PF} | +++ MONGOOSE UTILS READY: ${mguAppName}`);
});

const defaultEvolveOptionsPickArray = [
  "activation",
  "architecture",
  "binaryMode",
  "error",
  "hiddenLayerSize",
  "inputs",
  "inputsId",
  "iterations",
  "network",
  "networkTechnology",
  "numInputs",
  "schedule",
  "seedInputsId",
  "seedNetworkId",
  "seedNetworkRes",
];

const carrotEvolveOptionsPickArray = [
  "cost",
  "crossover",
  "efficientMutation",
  "elitism",
  "equal",
  "fitness",
  "fitnessPopulation",
  "growth",
  // "max_nodes",
  // "maxNodes",
  "maxConns",
  "maxGates",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "popsize",
  "populationSize",
  "provenance",
  "selection",
  "threads",
];

const neatapticEvolveOptionsPickArray = [
  "cost",
  "crossover",
  "elitism",
  "equal",
  "fitnessPopulation",
  "growth",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "popsize",
  "provenance",
  "selection",
  "threads",
];

const tensorflowEvolveOptionsPickArray = [
  "inputActivation",
  "outputActivation",
  "hiddenLayerSize",
  "optimizer",
  "loss",
  "metrics",
];

const combinedEvolveOptionsPickArray = _.union(
  defaultEvolveOptionsPickArray,
  tensorflowEvolveOptionsPickArray,
  carrotEvolveOptionsPickArray,
  neatapticEvolveOptionsPickArray
);

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
} else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const OFFLINE_MODE = false;

const tcuChildName = PF + "_TCU";
import ThreeceeUtilities from "@threeceelabs/threecee-utilities";
const tcUtils = new ThreeceeUtilities(tcuChildName);

const delay = tcUtils.delay;
const msToTime = tcUtils.msToTime;
const formatBoolean = tcUtils.formatBoolean;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;

import empty from "is-empty";
import path from "path";
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import watch from "watch";
import moment from "moment";
import HashMap from "hashmap";
import pick from "object.pick";
import shell from "shelljs";
import touch from "touch";
import kill from "tree-kill";
import objectPath from "object-path";
import merge from "deepmerge";
import table from "text-table";
import fs from "fs";
import { promisify } from "util";
const renameFileAsync = promisify(fs.rename);
const unlinkFileAsync = promisify(fs.unlink);
import debug from "debug";
import util from "util";
import deepcopy from "deep-copy";
import async from "async";
import omit from "object.omit";
import omitDeep from "omit-deep-lodash";

import cp from "child_process";
const childHashMap = {};

// import // const // const // const // const // const // const // const // const // const //=========================================================================

const statsObj = {};
let statsObjSmall = {};
let configuration = {};

const childConfiguration = {};

const watcherChildConfiguration = {};
watcherChildConfiguration.primaryHost = configuration.primaryHost;
watcherChildConfiguration.testMode = configuration.testMode;
watcherChildConfiguration.updateUserDb = false;

configuration.evolveTimeoutDuration = DEFAULT_EVOLVE_TIMEOUT_DURATION;

configuration.maxFriends = DEFAULT_MAX_FRIENDS;

configuration.zeroMinSuccess = EVOVLE_DEFAULTS.DEFAULT_ZERO_SUCCESS_MIN;
configuration.enableZeroSuccessEvolveOptions =
  EVOVLE_DEFAULTS.DEFAULT_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS;
configuration.viableNetworkTechArray =
  EVOVLE_DEFAULTS.DEFAULT_VIABLE_NETWORK_TECHNOLOGY_ARRAY;
configuration.forceNetworkTechnology =
  EVOVLE_DEFAULTS.DEFAULT_FORCE_NETWORK_TECHNOLOGY;
configuration.networkIdPrefix = "nn_" + getTimeStamp() + "_" + hostname;
configuration.removeSeedFromViableNetworkOnFail =
  EVOVLE_DEFAULTS.DEFAULT_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL;

configuration.binaryMode = EVOVLE_DEFAULTS.DEFAULT_BINARY_MODE;
configuration.enableRandomBinaryMode =
  EVOVLE_DEFAULTS.DEFAULT_ENABLE_RANDOM_BINARY_MODE;
configuration.userProfileOnlyFlag =
  EVOVLE_DEFAULTS.DEFAULT_USER_PROFILE_ONLY_FLAG;

configuration.compareTech = EVOVLE_DEFAULTS.DEFAULT_COMPARE_TECH;
configuration.networkTechnology = EVOVLE_DEFAULTS.DEFAULT_NETWORK_TECHNOLOGY;
configuration.enableRandomTechnology =
  EVOVLE_DEFAULTS.DEFAULT_ENABLE_RANDOM_NETWORK_TECHNOLOGY;

configuration.costArray = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_COST_ARRAY;

configuration.previousChildConfig = false;
configuration.offlineMode = OFFLINE_MODE;
configuration.primaryHost = PRIMARY_HOST;

configuration.purgeMin = DEFAULT_PURGE_MIN;
configuration.testMode = TEST_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;
configuration.maxFailNetworks = EVOVLE_DEFAULTS.DEFAULT_MAX_FAIL_NETWORKS;
configuration.minPassRatio = EVOVLE_DEFAULTS.DEFAULT_MIN_PASS_RATIO;

configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;

configuration.processName = process.env.TNN_PROCESS_NAME || "tnn_node";
configuration.networkCreateMode = "evolve";

configuration.childPingAllInterval = DEFAULT_CHILD_PING_INTERVAL;

configuration.archiveNotInInputsIdArray =
  DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY;
configuration.deleteNotInInputsIdArray = DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY;

configuration.disableCreateTestSet = DEFAULT_DISABLE_CREATE_TEST_SET;

configuration.inputsIdArray = [];
configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;

configuration.useLocalTrainingSets = DEFAULT_USE_LOCAL_TRAINING_SETS;
configuration.loadAllInputs = DEFAULT_LOAD_ALL_INPUTS;

configuration.interruptFlag = false;
configuration.useLocalNetworksOnly = false;
configuration.networkCreateIntervalTime = 15000;
configuration.enableSeedNetwork = true;

configuration.randomizeSeedOptions = DEFAULT_SEED_RANDOMIZE_OPTIONS;

configuration.seedNetworkProbability = DEFAULT_SEED_NETWORK_PROBABILITY;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;
configuration.enableRequiredTrainingSet = false;

if (hostname === "google") {
  configuration.cwd = "/home/tc/twitterNeuralNetwork";
} else {
  configuration.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
}

configuration.childAppPath = path.join(
  configuration.cwd,
  "neuralNetworkChild.js"
);
configuration.childIdPrefix = DEFAULT_CHILD_ID_PREFIX;
configuration.childIndex = 0;

childConfiguration.maxFriends = configuration.maxFriends;
childConfiguration.primaryHost = configuration.primaryHost;
childConfiguration.binaryMode = configuration.binaryMode;

childConfiguration.userProfileOnlyFlag = configuration.userProfileOnlyFlag;
childConfiguration.testMode = configuration.testMode;
childConfiguration.updateUserDb = false;

//=========================================================================
// SLACK
//=========================================================================
import { WebClient } from "@slack/web-api";

logger.info("process.env.SLACK_BOT_TOKEN: ", process.env.SLACK_BOT_TOKEN);
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const slackWebClient = new WebClient(slackBotToken);

const slackChannelFail = "nn-fail";
const slackChannelError = "nn-error";
const slackChannelPassHost = "nn-pass-host";
const slackChannelPassLocal = "nn-pass-local";
const slackChannelPassGlobal = "nn-pass-global";

const slackChannel = "nn";
let slackText = "";
const channelsHashMap = new HashMap();

let slackSendQueueInterval;
let slackSendQueueReady = true;
const slackSendQueue = [];

async function initSlackSendQueue() {
  clearInterval(slackSendQueueInterval);

  slackSendQueueReady = true;

  slackSendQueueInterval = setInterval(async function () {
    if (slackSendQueueReady && slackSendQueue.length > 0) {
      slackSendQueueReady = false;

      const slackSendObj = slackSendQueue.shift();

      await slackSendWebMessage(slackSendObj);

      slackSendQueueReady = true;
    }
  }, ONE_SECOND);

  // await slackSendWebMessage({});

  return;
}

async function slackSendWebMessage(msgObj) {
  try {
    const channel = msgObj.channel || configuration.slackChannel.id;
    const text = msgObj.text || msgObj;

    await slackWebClient.chat.postMessage({
      text: text,
      channel: channel,
    });
  } catch (err) {
    logger.error(PF + " | *** slackSendWebMessage ERROR: " + err);
    throw err;
  }
}

async function initSlackWebClient() {
  try {
    logger.info(MODULE_ID + " | INIT SLACK WEB CLIENT");

    const authTestResponse = await slackWebClient.auth.test();

    logger.info({ authTestResponse });

    const conversationsListResponse = await slackWebClient.conversations.list();

    conversationsListResponse.channels.forEach(async function (channel) {
      debug("TNN | SLACK CHANNEL | " + channel.id + " | " + channel.name);

      if (channel.name === slackChannel) {
        configuration.slackChannel = channel;

        const message = {
          channel: configuration.slackChannel.id,
          text: "OP",
        };

        message.attachments = [];
        message.attachments.push({
          text: "INIT",
          fields: [
            { title: "SRC", value: hostname + "_" + process.pid },
            { title: "MOD", value: MODULE_NAME },
            { title: "DST", value: "ALL" },
          ],
        });

        await slackWebClient.chat.postMessage(message);
      }

      channelsHashMap.set(channel.id, channel);
    });

    return;
  } catch (err) {
    logger.error("TNN | *** INIT SLACK WEB CLIENT ERROR: " + err);
    throw err;
  }
}

//=========================================================================
// HOST
//=========================================================================

const startTimeMoment = moment();

statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;

statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();
statsObj.status = "START";

statsObj.archiveFile = "";

statsObj.serverConnected = false;
statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;
statsObj.authenticated = false;

statsObj.maxChildrenCreated = false;

statsObj.queues = {};
statsObj.networkResults = {};

//=========================================================================
// TNN SPECIFIC
//=========================================================================

let childPingAllInterval;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";

const categorizedUserHistogram = {};

categorizedUserHistogram.left = 0;
categorizedUserHistogram.right = 0;
categorizedUserHistogram.neutral = 0;
categorizedUserHistogram.positive = 0;
categorizedUserHistogram.negative = 0;
categorizedUserHistogram.none = 0;

let hostBestNetworkFile;
let networkIndex = 0;
let bestNetworkFile;

const resultsHashmap = {};
let currentBestNetwork;

const viableNetworkIdSet = new Set();
const betterChildSeedNetworkIdSet = new Set();
const skipLoadNetworkSet = new Set();
let zeroSuccessEvolveOptionsSet = new Set();

const inputsIdTechHashMap = {};
inputsIdTechHashMap.networkTechnology = {};
inputsIdTechHashMap.networkTechnology.carrot = {};
inputsIdTechHashMap.networkTechnology.tensorflow = {};
inputsIdTechHashMap.networkTechnology.neataptic = {};

const inputsViableSet = new Set();
const inputsFailedSet = new Set();

const inputsSet = new Set();
const inputsNetworksHashMap = {};
const skipLoadInputsSet = new Set();

// ==================================================================
// DROPBOX
// ==================================================================
configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN =
  process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY =
  process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET =
  process.env.DROPBOX_WORD_ASSO_APP_SECRET;

configuration.DROPBOX.DROPBOX_CONFIG_FILE =
  process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE =
  process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const configDefaultFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/default"
);
const configHostFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility",
  hostname
);

const configDefaultFile =
  "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const configHostFile =
  hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const statsFolder = path.join(DROPBOX_ROOT_FOLDER, "stats", hostname);
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultZeroSuccessEvolveOptionsFile =
  "default_zeroSuccessEvolveOptions.json";

const childPidFolderLocal = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility",
  hostname,
  "children"
);

const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json";
const defaultUnionInputsConfigFile = "default_unionInputsConfig.json";

const defaultInputsFolder = path.join(configDefaultFolder, "inputs");
const globalBestNetworkFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/best/neuralNetworks"
);
const localBestNetworkFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/localBest/neuralNetworks"
);

const hostBestNetworkFolder = path.join(
  configHostFolder,
  "neuralNetworks/best"
);
const localFailNetworkFolder = path.join(
  configHostFolder,
  "neuralNetworks/fail"
);
const localArchiveNetworkFolder = path.join(
  configHostFolder,
  "neuralNetworks/archive"
);

configuration.local = {};
configuration.local.trainingSetsFolder = configHostFolder + "/trainingSets";
configuration.local.userDataFolder = path.join(DEFAULT_DATA_ROOT, "users");

configuration.default = {};
configuration.default.trainingSetsFolder =
  configDefaultFolder + "/trainingSets";
configuration.default.userDataFolder = path.join(DEFAULT_DATA_ROOT, "users");

configuration.archiveFileUploadCompleteFlagFolder =
  configuration[HOST].trainingSetsFolder + "/users";

configuration.trainingSetsFolder = configuration.default.trainingSetsFolder;

configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNumberChildren =
  process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined
    ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN
    : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;

childConfiguration.userDataFolder = configuration.default.userDataFolder;

childConfiguration.defaultUserArchiveFlagFile =
  configuration.defaultUserArchiveFlagFile;
childConfiguration.trainingSetsFolder = configuration.trainingSetsFolder;
childConfiguration.trainingSetFile = configuration.trainingSetFile;
childConfiguration.archiveFileUploadCompleteFlagFolder =
  configuration.archiveFileUploadCompleteFlagFolder;

configuration.globalViableSuccessRate = DEFAULT_GLOBAL_VIABLE_SUCCESS_RATE;
configuration.globalMinSuccessRate = DEFAULT_GLOBAL_MIN_SUCCESS_RATE;
configuration.localMinSuccessRate = DEFAULT_LOCAL_MIN_SUCCESS_RATE;
configuration.hostMinSuccessRate = DEFAULT_HOST_MIN_SUCCESS_RATE;
configuration.hostMinSuccessRateMSE = DEFAULT_HOST_MIN_SUCCESS_RATE_MSE;
configuration.hostPurgeMinSuccessRate = DEFAULT_HOST_PURGE_MIN_SUCCESS_RATE;

configuration.testSetRatio = DEFAULT_TEST_SET_RATIO;

configuration.evolve = {};
configuration.evolve.activation = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ACTIVATION;
configuration.evolve.activationArray =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ACTIVATION_ARRAY;
configuration.evolve.architecture = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ARCHITECTURE;
configuration.evolve.binaryMode = EVOVLE_DEFAULTS.DEFAULT_BINARY_MODE;
configuration.evolve.binaryModeProbability =
  EVOVLE_DEFAULTS.DEFAULT_BINARY_MODE_PROBABILITY;

configuration.evolve.tensorflowInputActivationArray =
  EVOVLE_DEFAULTS.DEFAULT_TENSORFLOW_TRAIN_INPUT_ACTIVATION_ARRAY;
configuration.evolve.tensorflowOutputActivationArray =
  EVOVLE_DEFAULTS.DEFAULT_TENSORFLOW_TRAIN_OUTPUT_ACTIVATION_ARRAY;
configuration.evolve.tensorflowOptimizerArray =
  EVOVLE_DEFAULTS.DEFAULT_TENSORFLOW_TRAIN_OPTIMIZER_ARRAY;
configuration.evolve.tensorflowLossArray =
  EVOVLE_DEFAULTS.DEFAULT_TENSORFLOW_TRAIN_LOSS_ARRAY;
configuration.evolve.tensorflowMetricsArray =
  EVOVLE_DEFAULTS.DEFAULT_TENSORFLOW_TRAIN_METRICS_ARRAY;

configuration.evolve.learningRate =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_LEARNING_RATE;
configuration.evolve.learningRateRange =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_LEARNING_RATE_RANGE;
configuration.evolve.cost = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_COST;
configuration.evolve.costArray = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_COST_ARRAY;
configuration.evolve.efficientMutation =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_EFFICIENT_MUTATION;
configuration.evolve.efficientMutationProbability =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_EFFICIENT_MUTATION_PROBABILITY;
configuration.evolve.elitism = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ELITISM;
configuration.evolve.elitismRange =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ELITISM_RANGE;
configuration.evolve.equal = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ERROR;
configuration.evolve.errorThresh =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ERROR_THRESHOLD;
configuration.evolve.errorThreshRange =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_ERROR_THRESHOLD_RANGE;
configuration.evolve.fitnessPopulation =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_FITNESS_POPULATION;
configuration.evolve.fitnessPopulationProbability =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_FITNESS_POPULATION_PROBABILITY;
configuration.evolve.growth = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_GROWTH;
configuration.evolve.growthRange = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_GROWTH_RANGE;
configuration.evolve.inputsToHiddenLayerSizeRatio =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO;
configuration.evolve.iterations = EVOVLE_DEFAULTS.DEFAULT_ITERATIONS;
configuration.evolve.log = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_LOG;
configuration.evolve.momentum = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MOMENTUM;
configuration.evolve.momentumRange =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MOMENTUM_RANGE;
configuration.evolve.mutation = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutationArray =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MUTATION_ARRAY;
configuration.evolve.mutationRate =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.mutationRateRange =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_MUTATION_RATE_RANGE;
configuration.evolve.networkId = EVOVLE_DEFAULTS.DEFAULT_SEED_NETWORK_ID;
configuration.evolve.networkObj = null;
configuration.evolve.popsize = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.provenance = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_PROVENANCE;
configuration.evolve.randomEvolveTechArray =
  EVOVLE_DEFAULTS.DEFAULT_RANDOM_EVOLVE_TECH_ARRAY;
configuration.evolve.selection = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_SELECTION;
configuration.evolve.selectionArray =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_SELECTION_ARRAY;
configuration.evolve.threads = EVOVLE_DEFAULTS.DEFAULT_EVOLVE_THREADS;
configuration.evolve.useBestNetwork =
  EVOVLE_DEFAULTS.DEFAULT_EVOLVE_BEST_NETWORK;

statsObj.evolveStats = {};
statsObj.evolveStats.results = {};
statsObj.evolveStats.total = 0;
statsObj.evolveStats.passLocal = 0;
statsObj.evolveStats.passGlobal = 0;
statsObj.evolveStats.fail = 0;
statsObj.evolveStats.viableInputs = [];
statsObj.evolveStats.zeroSuccessOptions = [];

statsObj.users = {};
statsObj.users.imageParse = {};
statsObj.users.imageParse.parsed = 0;
statsObj.users.imageParse.skipped = 0;
statsObj.users.notCategorized = 0;
statsObj.users.updatedCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.users.unzipped = 0;
statsObj.users.zipHashMapHit = 0;

statsObj.errors = {};
statsObj.errors.evolve = {};
statsObj.errors.evolve.timeouts = 0;

statsObj.errors.imageParse = {};
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;

const statsPickArray = [
  "pid",
  "startTime",
  "elapsed",
  "serverConnected",
  "status",
  "authenticated",
  "numChildren",
  "userReadyAck",
  "userReadyAckWait",
  "userReadyTransmitted",
  "networkResults",
];

statsObjSmall = pick(statsObj, statsPickArray);

function networkDefaults(networkObj) {
  return new Promise(function (resolve) {
    if (empty(networkObj)) {
      logger.error("networkDefaults ERROR: networkObj UNDEFINED");
      throw new Error("networkDefaults ERROR: networkObj UNDEFINED");
    }

    if (empty(networkObj.networkTechnology)) {
      networkObj.networkTechnology = "neataptic";
    }
    if (empty(networkObj.betterChild)) {
      networkObj.betterChild = false;
    }
    if (empty(networkObj.testCycles)) {
      networkObj.testCycles = 0;
    }
    if (empty(networkObj.testCycleHistory)) {
      networkObj.testCycleHistory = [];
    }
    if (empty(networkObj.overallMatchRate)) {
      networkObj.overallMatchRate = 0;
    }
    if (empty(networkObj.runtimeMatchRate)) {
      networkObj.runtimeMatchRate = 0;
    }
    if (empty(networkObj.matchRate)) {
      networkObj.matchRate = 0;
    }
    if (empty(networkObj.successRate)) {
      networkObj.successRate = 0;
    }

    resolve(networkObj);
  });
}

function printNetworkObj(title, networkObj) {
  logger.info(
    title +
      " | " +
      networkObj.networkTechnology.slice(0, 4).toUpperCase() +
      " | SR: " +
      networkObj.successRate.toFixed(2) +
      "%" +
      " | MR: " +
      networkObj.matchRate.toFixed(2) +
      "%" +
      " | OAMR: " +
      networkObj.overallMatchRate.toFixed(2) +
      "%" +
      " | RMR: " +
      networkObj.runtimeMatchRate.toFixed(2) +
      "%" +
      " | TC:  " +
      networkObj.testCycles +
      " | TCH:  " +
      networkObj.testCycleHistory.length +
      " | IN: " +
      networkObj.numInputs +
      " | IN ID:  " +
      networkObj.inputsId +
      " | " +
      networkObj.networkId
  );
}

const shortInputsId = function (inputsId) {
  // inputs_20200519_004028_1384_all_mms3_26627
  return inputsId.replace(/inputs_\d+_\d+_/g, "");
};

function printResultsHashmap() {
  return new Promise(function (resolve, reject) {
    if (Object.keys(resultsHashmap).length === 0) {
      return resolve();
    }
    const tableArray = [];

    tableArray.push([
      PF + " | NNID",
      "TECH",
      "STATUS",
      "BTR",
      "BIN",
      "SEED",
      "RES %",
      "HL",
      "INPUT ID",
      "ACTVTN",
      "CLR",
      "COST",
      "SELCTN",
      "GRWTH",
      "EQ",
      "MRATE",
      "ME",
      "POP",
      "EL",
      "ELPSD",
      "ITRS",
      "SPI",
      "RES %",
    ]);

    async.eachSeries(
      Object.keys(resultsHashmap),
      function (networkId, cb) {
        const networkObj = resultsHashmap[networkId];

        if (empty(networkObj)) {
          return cb("UNDEFINED");
        }

        if (empty(networkObj.evolve)) {
          networkObj.evolve = {};
          networkObj.evolve.options = {};
          networkObj.evolve.options.activation = "---";
          networkObj.evolve.options.clear = "---";
          networkObj.evolve.options.cost = "---";
          networkObj.evolve.options.growth = 0;
          networkObj.evolve.options.equal = "---";
          networkObj.evolve.options.mutationRate = 0;
          networkObj.evolve.options.efficientMutation = "---";
          networkObj.evolve.options.popsize = 0;
          networkObj.evolve.options.populationSize = 0;
          networkObj.evolve.options.selection = "---";
          networkObj.evolve.options.elitism = 0;
        }

        if (networkObj.inputsId === undefined) {
          logger.info("INPUTS ID UNDEFINED\n" + jsonPrint(networkObj));
          return cb("INPUTS ID UNDEFINED");
        }

        let nnTech = "";
        let status = "";
        let binaryMode = "F";
        let snIdRes = 0;
        let iterations = 0;
        let secPerIteration = 0;
        let cost = "";
        let error = 0;
        let popsize = 0;
        let elitism = 0;
        let fitness = 0;
        let activation = "";
        let successRate = 0;
        let elapsed = 0;
        let betterChild = "";
        let hiddenLayerSize = 0;
        let seedNetworkId = false;

        const growth =
          networkObj.evolve.options.growth &&
          networkObj.evolve.options.growth !== undefined
            ? networkObj.evolve.options.growth.toFixed(8)
            : "---";
        const selection =
          networkObj.evolve.options.selection &&
          networkObj.evolve.options.selection !== undefined
            ? networkObj.evolve.options.selection.slice(0, 6)
            : "---";
        const mutationRate =
          networkObj.evolve.options.mutationRate &&
          networkObj.evolve.options.mutationRate !== undefined
            ? networkObj.evolve.options.mutationRate.toFixed(3)
            : "---";

        nnTech =
          networkObj.networkTechnology &&
          networkObj.networkTechnology !== undefined
            ? networkObj.networkTechnology.slice(0, 4).toUpperCase()
            : "?";
        status =
          networkObj.status && networkObj.status !== undefined
            ? networkObj.status
            : "UNKNOWN";
        snIdRes =
          networkObj.seedNetworkRes && networkObj.seedNetworkRes !== undefined
            ? networkObj.seedNetworkRes.toFixed(3)
            : "---";
        betterChild =
          networkObj.betterChild && networkObj.betterChild !== undefined
            ? formatBoolean(networkObj.betterChild)
            : "---";
        binaryMode =
          networkObj.binaryMode && networkObj.binaryMode !== undefined
            ? formatBoolean(networkObj.binaryMode)
            : "F";
        hiddenLayerSize =
          networkObj.hiddenLayerSize && networkObj.hiddenLayerSize !== undefined
            ? networkObj.hiddenLayerSize
            : "---";
        seedNetworkId =
          networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined
            ? networkObj.seedNetworkId
            : "---";
        iterations =
          networkObj.evolve.results && networkObj.evolve.results !== undefined
            ? networkObj.evolve.results.iterations
            : 0;
        iterations = iterations || 0;

        cost =
          networkObj.networkTechnology !== "tensorflow"
            ? networkObj.evolve.options.cost.slice(0, 4)
            : "---";
        popsize =
          networkObj.networkTechnology !== "tensorflow"
            ? networkObj.evolve.options.popsize
            : "---";
        elitism =
          networkObj.networkTechnology !== "tensorflow"
            ? networkObj.evolve.options.elitism
            : "---";
        activation =
          networkObj.networkTechnology === "tensorflow"
            ? networkObj.evolve.options.inputActivation
            : networkObj.evolve.options.activation;

        error =
          networkObj.evolve.results &&
          networkObj.evolve.results !== undefined &&
          networkObj.evolve.results.error !== undefined &&
          networkObj.evolve.results.error
            ? networkObj.evolve.results.error
            : Infinity;

        fitness =
          networkObj.evolve.results &&
          networkObj.evolve.results !== undefined &&
          networkObj.evolve.results.fitness !== undefined &&
          networkObj.evolve.results.fitness
            ? networkObj.evolve.results.fitness
            : -Infinity;

        error =
          error > 1000 ? expo(error, 2) : Number.parseFloat(error).toFixed(5);
        fitness =
          fitness < -1000
            ? expo(fitness, 2)
            : Number.parseFloat(fitness).toFixed(5);

        successRate =
          (networkObj.successRate || networkObj.successRate === 0) &&
          networkObj.successRate !== undefined
            ? networkObj.successRate.toFixed(3)
            : 0;
        elapsed =
          networkObj.evolve.elapsed && networkObj.evolve.elapsed !== undefined
            ? networkObj.evolve.elapsed
            : moment().valueOf() - networkObj.evolve.startTime;

        if (
          networkObj.evolve.results &&
          networkObj.evolve.results !== undefined &&
          iterations > 0
        ) {
          secPerIteration = elapsed / (1000 * iterations);
        }

        const tableEntry = [
          PF + " | " + networkId,
          nnTech,
          status,
          betterChild,
          binaryMode,
          seedNetworkId,
          snIdRes,
          hiddenLayerSize,
          shortInputsId(networkObj.inputsId),
          activation,
          formatBoolean(networkObj.evolve.options.clear),
          cost,
          selection,
          growth,
          formatBoolean(networkObj.evolve.options.equal),
          mutationRate,
          formatBoolean(networkObj.evolve.options.efficientMutation),
          popsize,
          elitism,
          msToTime(elapsed),
          iterations,
          secPerIteration.toFixed(1),
          successRate,
        ];

        for (let i = 0; i < tableEntry.length; i++) {
          if (tableEntry[i] === undefined || tableEntry[i] === null) {
            logger.warn(
              PF + " | *** TABLE INDEX: " + i + " | " + tableEntry[i]
            );
            tableEntry[i] = "NULL";
          }
        }

        tableArray.push(tableEntry);

        if (empty(statsObj.networkResults[networkId])) {
          statsObj.networkResults[networkId] = {};
          statsObj.networkResults[networkId].networkObj = {};
          statsObj.networkResults[networkId].networkObj.evolve = {};
          statsObj.networkResults[networkId].networkObj.evolve.options = {};
          statsObj.networkResults[networkId].networkObj.evolve.results = {};
        }

        statsObj.networkResults[networkId].status = status;
        statsObj.networkResults[networkId].betterChild = betterChild;
        statsObj.networkResults[networkId].seedNetworkId = seedNetworkId;
        statsObj.networkResults[networkId].snIdRes = snIdRes;
        statsObj.networkResults[networkId].hiddenLayerSize = hiddenLayerSize;
        statsObj.networkResults[networkId].networkObj.evolve.options = pick(
          networkObj.evolve.options,
          combinedEvolveOptionsPickArray
        );
        statsObj.networkResults[networkId].startTime = getTimeStamp(
          networkObj.evolve.startTime
        );
        statsObj.networkResults[networkId].elapsed = msToTime(elapsed);
        statsObj.networkResults[networkId].iterations = iterations;
        statsObj.networkResults[networkId].error = error;
        statsObj.networkResults[networkId].fitness = fitness;
        statsObj.networkResults[networkId].successRate = successRate;

        cb();
      },
      function (err) {
        if (err) {
          return reject(err);
        }

        const t = table(tableArray, {
          align: [
            "l",
            "l",
            "l",
            "l",
            "l",
            "l",
            "l",
            "r",
            "l",
            "l",
            "l",
            "l",
            "l",
            "l",
            "l",
            "r",
            "l",
            "r",
            "r",
            "l",
            "r",
            "r",
            "r",
          ],
        });

        logger.info(
          PF +
            " | === NETWORK RESULTS ========================================================================================================================"
        );
        logger.info(t);
        logger.info(
          PF +
            " | ============================================================================================================================================"
        );

        resolve();
      }
    );
  });
}

async function initZeroSuccessEvolveOptionsSet(p) {
  statsObj.status = "INIT ZERO SUCCESS EVOLVE OPTIONS SET";

  const params = p || {};

  const folder = params.folder || configDefaultFolder;
  let file = params.file || defaultZeroSuccessEvolveOptionsFile;

  if (configuration.testMode) {
    file = file.replace(".json", "_test.json");
  }

  logger.info(
    PF + " | INIT ZERO SUCCESS EVOLVE OPTIONS SET" + " | " + folder + "/" + file
  );

  try {
    const result = await tcUtils.initSetFromFile({
      folder: folder,
      file: file,
      objArrayKey: "evolveOptionsCombination",
      resolveOnNotFound: true,
    });

    if (result) {
      if (params.overwrite) {
        logger.warn(
          PF + " | !!! OVERWRITE INIT ZERO SUCCESS EVOLVE OPTIONS SET"
        );
        zeroSuccessEvolveOptionsSet = result;
        zeroSuccessEvolveOptionsSet.delete("");
        zeroSuccessEvolveOptionsSet.delete(" ");
      } else {
        logger.info(PF + " | ... MERGE INIT ZERO SUCCESS EVOLVE OPTIONS SET");
        zeroSuccessEvolveOptionsSet = new Set([
          ...result,
          ...zeroSuccessEvolveOptionsSet,
        ]);
        zeroSuccessEvolveOptionsSet.delete("");
        zeroSuccessEvolveOptionsSet.delete(" ");
      }
    }

    logger.info(
      PF +
        " | LOADED ZERO SUCCESS EVOLVE OPTIONS FILE" +
        " | " +
        zeroSuccessEvolveOptionsSet.size +
        " EVOLVE COMBINATIONS" +
        " | " +
        folder +
        "/" +
        file
    );

    return;
  } catch (err) {
    logger.error(
      PF + " | *** INIT ZERO SUCCESS EVOLVE OPTIONS SET ERROR: " + err
    );
    throw err;
  }
}

function purgeNetwork(networkId) {
  logger.warn(PF + " | XXX PURGE NETWORK: " + networkId);

  viableNetworkIdSet.delete(networkId);
  betterChildSeedNetworkIdSet.delete(networkId);
  skipLoadNetworkSet.add(networkId);

  if (resultsHashmap[networkId] !== undefined) {
    resultsHashmap[networkId].status = "PURGED";
  }
}

function purgeInputs(inputsId) {
  return new Promise(function (resolve, reject) {
    try {
      if (!configuration.inputsIdArray.includes(inputsId)) {
        logger.info(PF + " | XXX PURGE INPUTS: " + inputsId);
        inputsSet.delete(inputsId);
        inputsViableSet.delete(inputsId);
        skipLoadInputsSet.add(inputsId);
        delete inputsIdTechHashMap.networkTechnology.carrot[inputsId];
        delete inputsIdTechHashMap.networkTechnology.tensorflow[inputsId];
        delete inputsIdTechHashMap.networkTechnology.neataptic[inputsId];
      } else {
        logger.info(
          PF +
            " | --- NO PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" +
            " | INPUTS ID: " +
            inputsId
        );

        if (configuration.verbose) {
          logger.info(
            PF +
              " | CONFIGURATION INPUTS ID ARRAY\n" +
              jsonPrint(configuration.inputsIdArray)
          );
        }
      }
      resolve();
    } catch (err) {
      return reject(err);
    }
  });
}

async function updateDbInputs(params) {
  try {
    if (empty(params.inputsId) && empty(params.inputsObj)) {
      throw new Error("undefined params.inputsId AND params.inputsObj");
    }

    let inputsId;

    if (params.inputsId) {
      inputsId = params.inputsId;
    } else if (params.inputsObj && params.inputsObj !== undefined) {
      inputsId = params.inputsObj.inputsId;
    } else {
      throw new Error("undefined params.inputsId AND params.inputsObj");
    }

    const query = { inputsId: inputsId };

    let inputsObj = await global.wordAssoDb.NetworkInputs.findOne(query).exec();

    if (inputsObj === undefined && params.inputsObj !== undefined) {
      const options = {
        new: true,
        returnOriginal: false,
        upsert: true,
        setDefaultsOnInsert: true,
      };

      inputsObj = await global.wordAssoDb.NetworkInputs.findOneAndUpdate(
        query,
        params.inputsObj,
        options
      ).exec();
    }

    if (inputsObj && inputsObj !== undefined) {
      if (empty(inputsObj.networks)) {
        inputsObj.networks = [];
      }

      if (empty(inputsObj.failNetworks)) {
        inputsObj.failNetworks = [];
      }

      if (params.networkId && !inputsObj.networks.includes(params.networkId)) {
        inputsObj.networks.push(params.networkId);
      }

      if (
        params.failNetworkId &&
        !inputsObj.failNetworks.includes(params.failNetworkId)
      ) {
        inputsObj.failNetworks.push(params.failNetworkId);
      }

      if (params.inputsObj && params.inputsObj.networks) {
        inputsObj.networks = _.union(
          params.inputsObj.networks,
          inputsObj.networks
        );
      }

      if (params.inputsObj && params.inputsObj.failNetworks) {
        inputsObj.failNetworks = _.union(
          params.inputsObj.failNetworks,
          inputsObj.failNetworks
        );
      }

      await updateInputsViabilitySet({ inputsObj: inputsObj });

      const niDbUpdated = await inputsObj.save();

      return niDbUpdated;
    } else if (params.inputsObj && params.inputsObj !== undefined) {
      if (
        params.networkId &&
        !params.inputsObj.networks.includes(params.networkId)
      ) {
        params.inputsObj.networks.push(params.networkId);
      }
      if (
        params.failNetworkId &&
        !params.inputsObj.failNetworks.includes(params.failNetworkId)
      ) {
        params.inputsObj.failNetworks.push(params.failNetworkId);
      }

      await updateInputsViabilitySet({ inputsObj: params.inputsObj });

      const ni = new global.wordAssoDb.NetworkInputs(params.inputsObj);

      const niDbUpdated = await ni.save();

      return niDbUpdated;
    } else {
      inputsViableSet.delete(inputsId);
      inputsSet.delete(inputsId);
      throw new Error(
        "updateDbInputs | INPUTS NOT IN DB + no INPUTS OBJ PARAM"
      );
    }
  } catch (e) {
    logger.error(
      "*** updateDbInputs | INPUTS FIND ONE ERROR: " +
        e +
        "\nINPUTS ID: " +
        inputsId
    );
    throw e;
  }
}

async function updateInputsViabilitySet(p) {
  const params = p || {};

  const maxFailNetworks =
    params.maxFailNetworks !== undefined
      ? params.maxFailNetworks
      : configuration.maxFailNetworks;
  const minPassRatio =
    params.minPassRatio !== undefined
      ? params.minPassRatio
      : configuration.minPassRatio;
  const minPassRatioPercent = 100 * minPassRatio;

  const numPassNetworks = params.inputsObj.networks
    ? params.inputsObj.networks.length
    : 0;
  const numFailNetworks = params.inputsObj.failNetworks
    ? params.inputsObj.failNetworks.length
    : 0;
  const totalNetworks = numPassNetworks + numFailNetworks;

  const passRatio = totalNetworks ? numPassNetworks / totalNetworks : 0;
  const passRatioPercent = 100 * passRatio;

  let inputsViable = false;

  if (numFailNetworks <= maxFailNetworks) {
    inputsViable = true;
  }

  if (passRatio >= minPassRatio) {
    inputsViable = true;
  }

  if (inputsViable) {
    inputsViableSet.add(params.inputsObj.inputsId);

    logger.info(
      PF +
        " | +++ VIABLE INPUTS [" +
        inputsViableSet.size +
        "]" +
        " | P/F/T: " +
        numPassNetworks +
        "/" +
        numFailNetworks +
        "/" +
        totalNetworks +
        " | MIN: " +
        minPassRatioPercent.toFixed(2) +
        "%" +
        " | SUCCESS: " +
        passRatioPercent.toFixed(2) +
        "%" +
        " | " +
        params.inputsObj.meta.numInputs +
        " | " +
        params.inputsObj.inputsId
    );
  } else {
    inputsViableSet.delete(params.inputsObj.inputsId);

    logger.info(
      PF +
        " | XXX NOT VIABLE INPUTS [" +
        inputsViableSet.size +
        "]" +
        " | P/F/T: " +
        numPassNetworks +
        "/" +
        numFailNetworks +
        "/" +
        totalNetworks +
        " | MIN: " +
        100 * minPassRatio.toFixed(2) +
        "%" +
        " | SUCCESS: " +
        passRatioPercent.toFixed(2) +
        "%" +
        " | " +
        params.inputsObj.meta.numInputs +
        " | " +
        params.inputsObj.meta.numInputs +
        " | " +
        params.inputsObj.inputsId
    );
  }

  return inputsViable;
}

async function loadNetworkFile(params) {
  let filePath;

  if (params.path) {
    filePath = params.path;
  } else {
    filePath = params.folder + "/" + params.file;
  }

  logger.info(PF + " | <<< LOAD NN FILE" + " | " + filePath);

  const networkObj = await tcUtils.loadFile({
    folder: params.folder,
    file: params.file,
  });

  networkObj.runtimeMatchRate = networkObj.runtimeMatchRate || 0;

  if (
    dotProp.has(networkObj, "evolve.options.networkTechnology") &&
    networkObj.evolve.options.networkTechnology !== networkObj.networkTechnology
  ) {
    logger.warn(
      PF +
        " | !!! INCORRECT NETWORK TECH | CHANGE " +
        networkObj.networkTechnology +
        " <-- " +
        networkObj.evolve.options.networkTechnology +
        " | " +
        networkObj.networkId
    );
    networkObj.networkTechnology = networkObj.evolve.options.networkTechnology;
  }

  if (
    configuration.forceNetworkTechnology &&
    networkObj.networkTechnology !== configuration.forceNetworkTechnology
  ) {
    logger.info(
      PF +
        " | --- NN TECH NOT FORCE NETWORK TECH ... SKIPPING" +
        " | " +
        networkObj.networkId +
        " | NN TECH: " +
        networkObj.networkTechnology +
        " | FORCE TECH: " +
        configuration.forceNetworkTechnology +
        " | " +
        filePath
    );

    skipLoadNetworkSet.add(networkObj.networkId);
    return;
  }

  if (
    !configuration.viableNetworkTechArray.includes(networkObj.networkTechnology)
  ) {
    logger.info(
      PF +
        " | --- NN TECH NOT VIABLE NETWORK TECH ... SKIPPING" +
        " | VIABLE TECH: " +
        configuration.viableNetworkTechArray +
        " | NN TECH: " +
        networkObj.networkTechnology +
        " | " +
        networkObj.networkId
    );

    skipLoadNetworkSet.add(networkObj.networkId);
    return;
  }

  if (
    dotProp.has(networkObj, "evolve.options.binaryMode") &&
    networkObj.evolve.options.binaryMode !== networkObj.binaryMode
  ) {
    logger.warn(
      PF +
        " | !!! INCORRECT BINARY MODE | CHANGE " +
        networkObj.binaryMode +
        " <-- " +
        networkObj.evolve.options.binaryMode +
        " | " +
        networkObj.networkId
    );
    networkObj.binaryMode = networkObj.evolve.options.binaryMode;
  }

  const dbInputsObj = await updateDbInputs({
    inputsId: networkObj.inputsId,
    networkId: networkObj.networkId,
  });

  const inputsObj = dbInputsObj.toObject();

  if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {
    if (
      configuration.archiveNotInInputsIdArray &&
      filePath.toLowerCase().includes(hostBestNetworkFolder.toLowerCase())
    ) {
      logger.info(
        PF +
          " | 000 HOST BEST NN INPUTS NOT IN INPUTS ID ARRAY ... ARCHIVING" +
          " | NUM INPUTS: " +
          networkObj.numInputs +
          " | INPUTS ID: " +
          networkObj.inputsId +
          " | " +
          filePath
      );

      await renameFileAsync(
        path.join(hostBestNetworkFolder, params.file),
        path.join(localArchiveNetworkFolder, params.file)
      );
      return;
    } else if (
      configuration.deleteNotInInputsIdArray &&
      filePath.toLowerCase().includes(hostBestNetworkFolder.toLowerCase())
    ) {
      logger.info(
        PF +
          " | XXX HOST BEST NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING" +
          " | NUM INPUTS: " +
          networkObj.numInputs +
          " | INPUTS ID: " +
          networkObj.inputsId +
          " | " +
          filePath
      );
      await unlinkFileAsync(path.join(hostBestNetworkFolder, params.file));
      return;
    }

    logger.info(
      PF +
        " | --- HOST BEST NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING" +
        " | NUM INPUTS: " +
        networkObj.numInputs +
        " | INPUTS ID: " +
        networkObj.inputsId +
        " | " +
        filePath
    );

    skipLoadNetworkSet.add(networkObj.networkId);
    return;
  }

  //========================
  // SAVE LOCAL NETWORK TO GLOBAL
  //========================

  if (
    params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase() &&
    !viableNetworkIdSet.has(networkObj.networkId) &&
    (networkObj.successRate >= configuration.globalMinSuccessRate ||
      networkObj.overallMatchRate >= configuration.globalMinSuccessRate)
  ) {
    viableNetworkIdSet.add(networkObj.networkId);

    if (
      empty(
        inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
          networkObj.inputsId
        ]
      )
    ) {
      inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
        networkObj.inputsId
      ] = new Set();
    }

    inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
      networkObj.inputsId
    ].add(networkObj.networkId);

    logger.info(
      PF +
        " | ### MOVE NN FROM LOCAL TO GLOBAL BEST" +
        " | " +
        params.folder +
        "/" +
        params.file
    );

    printNetworkObj(
      PF + " | LOCAL > GLOBAL" + " | " + params.folder,
      networkObj
    );

    saveFileQueue.push({
      folder: globalBestNetworkFolder,
      file: params.file,
      obj: networkObj,
    });
    await unlinkFileAsync(path.join(params.folder, params.file));
  }

  //========================
  // NETWORK PASS SUCCESS or MATCH MIN
  //========================

  const passed = networkPass({
    folder: params.folder,
    purgeMin: params.purgeMin,
    networkObj: networkObj,
  });

  if (passed) {
    viableNetworkIdSet.add(networkObj.networkId);

    if (
      empty(
        inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
          networkObj.inputsId
        ]
      )
    ) {
      inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
        networkObj.inputsId
      ] = new Set();
    }

    inputsIdTechHashMap.networkTechnology[networkObj.networkTechnology][
      networkObj.inputsId
    ].add(networkObj.networkId);

    printNetworkObj(
      PF + " | +++ VIABLE NN [" + viableNetworkIdSet.size + "]",
      networkObj
    );

    if (
      !currentBestNetwork ||
      networkObj.overallMatchRate > currentBestNetwork.overallMatchRate ||
      (!networkObj.overallMatchRate &&
        !currentBestNetwork.overallMatchRate &&
        networkObj.successRate > currentBestNetwork.successRate)
    ) {
      currentBestNetwork = networkObj;
      printNetworkObj(PF + " | ===> NEW BEST NN <===", networkObj);
    }

    //========================
    // UPDATE INPUTS HASHMAP
    //========================

    const inObj = {};

    inObj.inputsObj = {};
    inObj.inputsObj = inputsObj;
    inObj.entry = {};
    inObj.entry.name = inputsObj.inputsId + ".json";
    inObj.entry.content_hash = false;
    inObj.entry.client_modified = moment();

    inputsSet.add(networkObj.inputsId);

    if (empty(inputsNetworksHashMap[networkObj.inputsId])) {
      inputsNetworksHashMap[networkObj.inputsId] = new Set();
    }

    inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

    //========================
    // UPDATE DB
    //========================
    let nnDb;

    try {
      nnDb = await updateDbNetwork({
        networkObj: networkObj,
        addToTestHistory: true,
      });
    } catch (err) {
      logger.error(
        "*** ERROR: DB NN FIND ONE ERROR | " +
          networkObj.networkId +
          " | " +
          err
      );
      throw err;
    }

    if (nnDb) {
      if (
        !currentBestNetwork ||
        nnDb.overallMatchRate > currentBestNetwork.overallMatchRate
      ) {
        currentBestNetwork = nnDb;
        printNetworkObj(PF + " | *** NEW BEST NN (DB)", nnDb);
      }

      viableNetworkIdSet.add(nnDb.networkId);

      if (
        empty(
          inputsIdTechHashMap.networkTechnology[nnDb.networkTechnology][
            nnDb.inputsId
          ]
        )
      ) {
        inputsIdTechHashMap.networkTechnology[nnDb.networkTechnology][
          nnDb.inputsId
        ] = new Set();
      }

      inputsIdTechHashMap.networkTechnology[nnDb.networkTechnology][
        nnDb.inputsId
      ].add(nnDb.networkId);
    }

    return nnDb;
  }

  //========================
  // PURGE FAILING NETWORKS
  //========================

  if (
    (hostname === PRIMARY_HOST &&
      params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()) ||
    (hostname !== PRIMARY_HOST &&
      params.folder.toLowerCase() === hostBestNetworkFolder.toLowerCase())
  ) {
    printNetworkObj(
      PF +
        " | XXX DELETING NN [" +
        viableNetworkIdSet.size +
        " IN SET]" +
        " | FOLDER: " +
        params.folder,
      networkObj
    );

    purgeNetwork(networkObj.networkId);
    await purgeInputs(networkObj.inputsId);
    await unlinkFileAsync(path.join(params.folder, params.file));

    return;
  }

  printNetworkObj(
    PF +
      " | --- NN HASH MAP [" +
      viableNetworkIdSet.size +
      " IN SET]" +
      " | PRI HOST: " +
      PRIMARY_HOST +
      " | FOLDER: " +
      params.folder +
      "\n" +
      PF +
      " | --- NN HASH MAP [" +
      viableNetworkIdSet.size +
      " IN SET]",
    networkObj
  );

  return networkObj;
}

async function loadInputsFile(params) {
  try {
    const inputsObj = await tcUtils.loadFile({
      folder: params.folder,
      file: params.file,
    });

    if (empty(inputsObj)) {
      logger.error(PF + " | INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? ");
      throw new Error("JSON UNDEFINED");
    }

    if (empty(inputsObj.meta)) {
      inputsObj.meta = {};
      inputsObj.meta.numInputs = 0;
      for (const inputType of Object.keys(inputsObj.inputs)) {
        inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
      }
    }

    const inputsViable = await updateInputsViabilitySet({
      inputsObj: inputsObj,
    });

    const dbInputsObj = await updateDbInputs({ inputsObj: inputsObj });

    inputsSet.add(dbInputsObj.inputsId);

    if (empty(inputsNetworksHashMap[dbInputsObj.inputsId])) {
      inputsNetworksHashMap[dbInputsObj.inputsId] = new Set();
    }

    logger.info(
      PF +
        " | +++ INPUTS [" +
        inputsSet.size +
        "]" +
        " |  INPUTS VIABLE: " +
        inputsViable +
        " | " +
        dbInputsObj.meta.numInputs +
        " INPUTS" +
        " | " +
        dbInputsObj.inputsId
    );

    return inputsObj;
  } catch (err) {
    logger.error(PF + " | INPUTS LOAD FILE ERROR: " + err);
    throw err;
  }
}

async function updateDbNetwork(params) {
  return new Promise(function (resolve, reject) {
    statsObj.status = "UPDATE DB NETWORKS";

    if (configuration.verbose) {
      printNetworkObj(
        PF + " | [" + viableNetworkIdSet.size + "] >>> UPDATE NN DB",
        params.networkObj
      )
        .then(function () {})
        .catch(function (err) {
          return reject(err);
        });
    }

    const networkObj = params.networkObj;
    const seedNetworkId =
      networkObj.seedNetworkId &&
      networkObj.seedNetworkId !== undefined &&
      networkObj.seedNetworkId !== "false"
        ? networkObj.seedNetworkId
        : null;
    const seedNetworkRes =
      networkObj.seedNetworkRes !== undefined &&
      networkObj.seedNetworkRes !== "false"
        ? networkObj.seedNetworkRes
        : 0;
    const incrementTestCycles =
      params.incrementTestCycles !== undefined
        ? params.incrementTestCycles
        : false;
    const testHistoryItem =
      params.testHistoryItem !== undefined ? params.testHistoryItem : false;
    const addToTestHistory =
      params.addToTestHistory !== undefined ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    const query = { networkId: networkObj.networkId };

    const update = {};

    update.$setOnInsert = {
      networkTechnology: networkObj.networkTechnology,
      seedNetworkId: seedNetworkId,
      seedNetworkRes: seedNetworkRes,
      successRate: networkObj.successRate,
      numInputs: networkObj.numInputs,
      numOutputs: networkObj.numOutputs,
      inputsId: networkObj.inputsId,
      outputs: networkObj.outputs,
      evolve: networkObj.evolve,
      test: networkObj.test,
    };

    update.$set = {
      network: networkObj.networkJson,
      matchRate: networkObj.matchRate,
      overallMatchRate: networkObj.overallMatchRate,
    };

    if (incrementTestCycles) {
      update.$inc = { testCycles: 1 };
    }

    if (testHistoryItem) {
      update.$push = { testCycleHistory: testHistoryItem };
    } else if (addToTestHistory) {
      update.$addToSet = {
        testCycleHistory: { $each: networkObj.testCycleHistory },
      };
    }

    const options = {
      new: true,
      returnOriginal: false,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    global.wordAssoDb.NeuralNetwork.findOneAndUpdate(
      query,
      update,
      options,
      async function (err, nnDbUpdated) {
        if (err) {
          logger.error("*** updateDbNetwork | NETWORK FIND ONE ERROR: " + err);
          return reject(err);
        }

        if (verbose) {
          printNetworkObj(PF + " | +++ NN DB UPDATED", nnDbUpdated);
        }

        const nnObj = nnDbUpdated.toObject();
        delete nnObj._id;

        resolve(nnObj);
      }
    );
  });
}

function networkPass(params) {
  const pass =
    //    ((params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()) && (params.networkObj.successRate >= configuration.globalMinSuccessRate))
    // || ((params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()) && (params.networkObj.matchRate >= configuration.globalMinSuccessRate))
    (params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.successRate >= configuration.globalViableSuccessRate) ||
    (params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.matchRate >= configuration.globalViableSuccessRate) ||
    (params.purgeMin &&
      params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.overallMatchRate === 0 &&
      params.networkObj.matchRate === 0 &&
      params.networkObj.successRate >= configuration.hostPurgeMinSuccessRate) ||
    (params.purgeMin &&
      params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.overallMatchRate === 0 &&
      params.networkObj.matchRate >= configuration.hostPurgeMinSuccessRate) ||
    (!params.purgeMin &&
      params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.successRate >= configuration.hostMinSuccessRate) ||
    (!params.purgeMin &&
      params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase() &&
      params.networkObj.matchRate >= configuration.hostMinSuccessRate);

  return pass;
}

async function loadBestNetworkFolders(p) {
  const params = p || {};

  logger.info(
    PF +
      " | ... LOADING BEST NN FOLDERS" +
      " | " +
      params.folders.length +
      " FOLDERS" +
      "\n" +
      jsonPrint(params.folders)
  );

  let files = await tcUtils.listFolders({ folders: params.folders });

  if (configuration.testMode) {
    files = files.slice(0, 20);
  }

  logger.info(PF + " | ... FOUND " + files.length + " FILES IN NN FOLDERS");

  for (const fileObj of files) {
    if (
      fileObj.file.toLowerCase() === bestRuntimeNetworkFileName.toLowerCase()
    ) {
      logger.info(PF + " | ... SKIPPING LOAD OF " + fileObj.file);
      continue;
    }

    if (!fileObj.file.endsWith(".json")) {
      logger.info(PF + " | ... SKIPPING LOAD OF " + fileObj.file);
      continue;
    }

    const fileNameArray = fileObj.file.split(".");
    const networkId = fileNameArray[0];

    if (skipLoadNetworkSet.has(networkId)) {
      logger.info(
        PF +
          " | NN IN SKIP SET | SKIPPING ..." +
          " | " +
          fileObj.path +
          " | " +
          networkId
      );
      continue;
    }

    if (configuration.verbose) {
      logger.info(
        PF + " | NN FOUND" + " | " + fileObj.path + " | " + networkId
      );
    }

    try {
      await loadNetworkFile({
        folder: fileObj.folder,
        file: fileObj.file,
        purgeMin: params.purgeMin,
      });
    } catch (err) {
      logger.error(
        PF +
          " | *** LOAD NN ENTRY ERROR: " +
          err +
          " | " +
          fileObj.folder +
          "/" +
          fileObj.file +
          " | " +
          networkId
      );
    }
  }

  return;
}

async function loadInputsFolders(p) {
  const params = p || {};

  logger.info(
    PF +
      " | ... LOADING INPUTS FOLDERS" +
      " | " +
      params.folders.length +
      " FOLDERS" +
      "\n" +
      jsonPrint(params.folders)
  );

  const files = await tcUtils.listFolders({ folders: params.folders });

  for (const fileObj of files) {
    try {
      if (!fileObj.file.endsWith(".json")) {
        logger.info(PF + " | ... SKIPPING INPUTS LOAD OF " + fileObj.path);
        continue;
      }

      const fileNameArray = fileObj.file.split(".");
      const inputsId = fileNameArray[0];

      if (!configuration.inputsIdArray.includes(inputsId)) {
        logger.info(
          PF + " | --- INPUTS ... NOT IN INPUTS ARRAY" + " | " + fileObj.path
        );
        continue;
      }

      if (configuration.verbose) {
        logger.info(
          PF + " | INPUTS FOUND" + " | " + inputsId + " | " + fileObj.path
        );
      }

      let inputsObj;

      try {
        inputsObj = await loadInputsFile({
          folder: fileObj.folder,
          file: fileObj.file,
        });
      } catch (e) {
        logger.error(
          PF +
            " | *** LOAD INPUTS FILE ERROR | ... SKIPPING: " +
            fileObj.folder +
            "/" +
            fileObj.file +
            " | ERROR: " +
            e
        );
        continue;
      }

      if (inputsObj.inputsId || inputsObj.inputsId !== undefined) {
        inputsSet.add(inputsObj.inputsId);
        // printInputsObj(PF + " | +++ INPUTS DB UPDATED", inputsObj);
      } else {
        logger.error(
          PF +
            " | *** INPUTS OBJ ERROR | UNDEFINED INPUTS ID\n" +
            jsonPrint(inputsObj)
        );
        continue;
      }
    } catch (err) {
      logger.error(PF + " | *** LOAD INPUTS FILE ERROR: " + err);
      throw err;
    }
  }

  return;
}

async function generateSeedInputsNetworkId(params) {
  try {
    logger.info(PF + " | ... GENERATE SEED INPUTS/NETWORK ...");

    const config = params.config || {};

    //
    // if available use better child as seed nn
    //

    if (betterChildSeedNetworkIdSet.size > 0) {
      logger.info(
        PF +
          " | USING BETTER CHILD SEED NETWORK | AVAIL BETTER CHILDREN: " +
          betterChildSeedNetworkIdSet.size
      );

      config.seedNetworkId = betterChildSeedNetworkIdSet.keys().next().value;

      logger.info(
        PF +
          " | ... SEARCH DB FOR BETTER CHILD SEED NETWORK: " +
          config.seedNetworkId
      );

      const networkObj = await global.wordAssoDb.NeuralNetwork.findOne({
        networkId: config.seedNetworkId,
      })
        .lean()
        .exec();

      if (!networkObj) {
        logger.error(
          PF +
            " | *** BETTER CHILD SEED NETWORK ERROR: NN NOT IN DB | SEED NN ID: " +
            config.seedNetworkId
        );
        throw new Error("SEED NN NOT IN DB: " + config.seedNetworkId);
      }

      logger.info(
        PF + " | FOUND DB BETTER CHILD SEED NETWORK: " + networkObj.networkId
      );

      betterChildSeedNetworkIdSet.delete(config.seedNetworkId);

      config.numInputs = networkObj.numInputs;
      config.binaryMode = networkObj.binaryMode || false;
      // config.logScaleMode = networkObj.logScaleMode || false;
      config.networkTechnology = networkObj.networkTechnology;
      config.seedInputsId = networkObj.inputsId;
      config.seedNetworkRes = networkObj.successRate;
      config.isBetterChildSeed = true;

      logger.info(
        PF +
          " | USING BETTER CHILD SEED [" +
          betterChildSeedNetworkIdSet.size +
          " REMAINING NNs IN BETTER CHILD POOL]" +
          " | NN ID: " +
          networkObj.networkId +
          " | BINARY MODE: " +
          formatBoolean(networkObj.binaryMode) +
          " | SUCCESS: " +
          networkObj.successRate.toFixed(3) +
          " | TECH: " +
          networkObj.networkTechnology +
          " | INPUTS ID: " +
          networkObj.inputsId
      );

      return config;
    }

    //
    // no better children, so try a viable input set
    //

    const viableInputsIdArray = [...inputsViableSet].sort();
    const failedInputsIdArray = [...inputsFailedSet];
    const availableInputsIdArray = _.difference(
      viableInputsIdArray,
      failedInputsIdArray
    );

    //
    // no input set with no networks, so maybe random network
    //

    const useRandomNetwork =
      Math.random() <= configuration.seedNetworkProbability;
    const randomTechnology = config.forceNetworkTechnology
      ? config.forceNetworkTechnology
      : _.sample(configuration.evolve.randomEvolveTechArray);

    if (
      useRandomNetwork &&
      Object.keys(inputsIdTechHashMap.networkTechnology[randomTechnology])
        .length > 0
    ) {
      logger.info(
        PF +
          " | USING RANDOM SEED NETWORK | AVAIL SEED NNs: " +
          Object.keys(inputsIdTechHashMap.networkTechnology[randomTechnology])
            .length
      );

      const randomInputsId = _.sample(
        Object.keys(inputsIdTechHashMap.networkTechnology[randomTechnology])
      );
      const randomNetworkIdSet =
        inputsIdTechHashMap.networkTechnology[randomTechnology][randomInputsId];

      logger.info(
        PF +
          " | RANDOM SEED: " +
          randomInputsId +
          " | INPUTS NN SET SIZE: " +
          randomNetworkIdSet.size
      );

      if (randomNetworkIdSet.size > 0) {
        const randomNetworkId = _.sample([...randomNetworkIdSet]);

        const networkObj = await global.wordAssoDb.NeuralNetwork.findOne({
          networkId: randomNetworkId,
        })
          .lean()
          .exec();

        if (!networkObj) {
          logger.error(
            PF +
              " | *** GENERATE SEED INPUTS NETWORK ID ERROR: NN NOT IN DB | RANDOM NN ID: " +
              randomNetworkId
          );
          throw new Error("RANDOM NN NOT IN DB: " + randomNetworkId);
        }

        config.networkTechnology = networkObj.networkTechnology;
        config.binaryMode = networkObj.binaryMode;
        // config.logScaleMode = networkObj.logScaleMode;
        config.seedNetworkId = randomNetworkId;
        config.seedNetworkRes = networkObj.successRate;
        config.seedInputsId = randomInputsId;
        config.inputsId = randomInputsId;
        config.numInputs = networkObj.numInputs;
        config.isBetterChildSeed = false;

        logger.info(
          PF +
            " | USE RANDOM SEED NETWORK [" +
            randomNetworkIdSet.size +
            " NNs IN SEED POOL]" +
            " | NN ID: " +
            networkObj.networkId +
            " | TECH: " +
            networkObj.networkTechnology +
            " | SUCCESS RATE: " +
            networkObj.successRate.toFixed(3) +
            "%" +
            " | INPUTS ID: " +
            networkObj.inputsId
        );

        return config;
      } else {
        logger.info(
          PF +
            " | generateSeedInputsNetworkId | NO RANDOM SEED NETWORKS [" +
            randomNetworkIdSet.size +
            " NNs IN SEED POOL]"
        );
        return config;
      }
    } else if (availableInputsIdArray.length > 0) {
      logger.info(
        PF + " | VIABLE NETWORKS INPUTS: " + availableInputsIdArray.length
      );

      availableInputsIdArray.sort();

      config.seedInputsId = availableInputsIdArray.pop(); // most recent input
      config.inputsId = config.seedInputsId;

      logger.info(PF + " | SEED | AVAILABLE INPUTS ID: " + config.inputsId);

      const inputsObj = await global.wordAssoDb.NetworkInputs.findOne({
        inputsId: config.inputsId,
      })
        .lean()
        .exec();

      if (!inputsObj) {
        logger.error(
          PF +
            " | *** INPUTS NOT FOUND IN DB" +
            " | INPUTS ID: " +
            config.inputsId
        );
        throw new Error("INPUTS NOT FOUND: " + config.inputsId);
      }

      config.numInputs = inputsObj.meta.numInputs;

      logger.info(
        PF +
          " | VIABLE INPUT" +
          " | VIABLE INPUTS: " +
          inputsViableSet.size +
          " | AVAIL INPUTS: " +
          availableInputsIdArray.length +
          " | SEED INPUTS ID: " +
          config.seedInputsId +
          " | NUM INPUTS: " +
          config.numInputs
      );

      return config;
    } else if (inputsSet.size === 0) {
      //
      // no random network, so random inputSet
      //

      logger.error(PF + " | *** EMPTY INPUTS SET [" + inputsSet.size + "]");
      throw new Error("EMPTY INPUTS SET");
    } else {
      config.seedInputsId = _.sample([...inputsSet]);

      const inputsObj = await global.wordAssoDb.NetworkInputs.findOne({
        inputsId: config.seedInputsId,
      })
        .lean()
        .exec();
      config.numInputs = inputsObj.meta.numInputs;

      logger.info(
        PF +
          " | RANDOM INPUT [" +
          inputsSet.size +
          "]" +
          " | " +
          config.seedInputsId +
          " | NUM INPUTS: " +
          config.numInputs
      );

      return config;
    }
  } catch (err) {
    logger.error(PF + " | *** GENERATE SEED INPUTS NETWORK ID ERROR: " + err);
    throw err;
  }
}

async function generateEvolveOptions(params) {
  try {
    const config = params.config;

    let attempts = 1;
    let key;

    do {
      logger.info(
        PF +
          " | ... GENERATE EVOLVE OPTIONS ... | ATTEMPTS: " +
          attempts +
          " | KEY: " +
          key
      );

      if (config.networkTechnology === "tensorflow") {
        config.inputActivation = _.sample(
          configuration.evolve.tensorflowInputActivationArray
        );
        config.outputActivation = _.sample(
          configuration.evolve.tensorflowOutputActivationArray
        );
        config.optimizer = _.sample(
          configuration.evolve.tensorflowOptimizerArray
        );
        config.loss = _.sample(configuration.evolve.tensorflowLossArray);
        config.metrics = configuration.evolve.tensorflowMetricsArray;
        logger.info({ config });
      } else {
        config.activation = _.sample(configuration.evolve.activationArray);
      }

      config.clear = false;

      // neataptic doesn't have WAPE cost
      const costArray =
        config.networkTechnology === "neataptic"
          ? _.pull(configuration.evolve.costArray, "WAPE")
          : configuration.evolve.costArray;

      config.cost = _.sample(costArray);
      config.efficientMutation =
        Math.random() <= configuration.evolve.efficientMutationProbability;
      config.elitism = _.random(
        configuration.evolve.elitismRange.min,
        configuration.evolve.elitismRange.max
      );
      config.equal = true;
      config.error = configuration.evolve.error;
      config.fitnessPopulation =
        Math.random() <= configuration.evolve.fitnessPopulationProbability;
      config.growth = _.random(
        configuration.evolve.growthRange.min,
        configuration.evolve.growthRange.max,
        true
      );
      config.iterations = configuration.evolve.iterations;
      config.learningRate = _.random(
        configuration.evolve.learningRateRange.min,
        configuration.evolve.learningRateRange.max,
        true
      );
      config.log = configuration.evolve.log;
      config.momentum = _.random(
        configuration.evolve.momentumRange.min,
        configuration.evolve.momentumRange.max,
        true
      );
      config.mutation = configuration.evolve.mutation;
      config.mutationAmount = 1;
      config.mutationRate = _.random(
        configuration.evolve.mutationRateRange.min,
        configuration.evolve.mutationRateRange.max,
        true
      );
      config.popsize = configuration.evolve.popsize;
      config.populationSize = configuration.evolve.popsize;
      config.provenance = configuration.evolve.provenance;
      config.selection = _.sample(configuration.evolve.selectionArray);
      config.threads = configuration.evolve.threads;
      config.timeout = configuration.evolve.timeout;

      key = config.activation + ":" + config.cost + ":" + config.selection;
      key = key.toUpperCase();

      attempts += 1;
    } while (
      configuration.enableZeroSuccessEvolveOptions &&
      zeroSuccessEvolveOptionsSet.has(key) &&
      attempts < 20
    );

    return config;
  } catch (err) {
    logger.error(PF + " | *** GENERATE EVOLVE OPTIONS ERROR: " + err);
    throw err;
  }
}

function pickTechnologyOptions(config) {
  let pickArray = [];

  switch (config.networkTechnology) {
    case "tensorflow":
      pickArray = _.union(
        defaultEvolveOptionsPickArray,
        tensorflowEvolveOptionsPickArray
      );
      break;
    case "carrot":
      pickArray = _.union(
        defaultEvolveOptionsPickArray,
        carrotEvolveOptionsPickArray
      );
      break;
    case "neataptic":
      pickArray = _.union(
        defaultEvolveOptionsPickArray,
        neatapticEvolveOptionsPickArray
      );
      break;
    default:
      logger.error(
        PF +
          " | *** generateRandomEvolveConfig ERROR | UNKNOWN NETWORK TECHNOLOGY: " +
          config.networkTechnology
      );
      throw new Error(
        "generateRandomEvolveConfig UNKNOWN NETWORK TECHNOLOGY: " +
          config.networkTechnology
      );
  }
  return pick(config, pickArray);
}

async function generateRandomEvolveConfig(p) {
  const params = p || {};

  statsObj.status = "GENERATE EVOLVE CONFIG";

  logger.info(PF + " | GENERATE RANDOM EVOLVE CONFIG");

  let config = {};

  config.networkCreateMode = "evolve";

  if (
    configuration.forceNetworkTechnology &&
    configuration.forceNetworkTechnology !== undefined
  ) {
    config.networkTechnology = configuration.forceNetworkTechnology;
    config.forceNetworkTechnology = configuration.forceNetworkTechnology;
    logger.info(
      PF + " | FORCE NETWORK TECHNOLOGY | " + config.networkTechnology
    );
  } else {
    if (configuration.enableRandomTechnology) {
      config.networkTechnology = _.sample(
        configuration.evolve.randomEvolveTechArray
      );
      logger.info(
        PF + " | RANDOM NETWORK TECHNOLOGY | " + config.networkTechnology
      );
    } else {
      config.networkTechnology = configuration.networkTechnology;
      logger.info(
        PF + " | DEFAULT NETWORK TECHNOLOGY | " + config.networkTechnology
      );
    }
  }

  if (configuration.enableRandomBinaryMode) {
    config.binaryMode =
      Math.random() <= configuration.evolve.binaryModeProbability;
    logger.warn(PF + " | RANDOM BINARY MODE: " + config.binaryMode);
  } else {
    config.binaryMode = params.binaryMode || configuration.binaryMode;
  }

  logger.info(PF + " | NETWORK TECHNOLOGY:      " + config.networkTechnology);
  logger.info(PF + " | BINARY MODE:             " + config.binaryMode);

  debug(PF + " | NETWORK CREATE MODE: " + config.networkCreateMode);

  config = await generateSeedInputsNetworkId({ config: config });
  config = await generateEvolveOptions({ config: config });

  // SEED NETWORK?
  if (
    configuration.enableSeedNetwork &&
    config.seedNetworkId &&
    config.seedNetworkId !== undefined &&
    config.seedNetworkId !== false &&
    viableNetworkIdSet.has(config.seedNetworkId)
  ) {
    try {
      const networkObj = await global.wordAssoDb.NeuralNetwork.findOne({
        networkId: config.seedNetworkId,
      })
        .lean()
        .exec();

      if (!networkObj) {
        logger.error(
          PF + " | *** DB FIND SEED NN ERROR | " + config.seedNetworkId
        );
        throw new Error("SEED NN not found: " + config.seedNetworkId);
      }

      logger.info(PF + " | +++ DB FIND SEED NN | " + networkObj.networkId);

      const dbNetworkObj = await networkDefaults(networkObj);

      config.hiddenLayerSize =
        dbNetworkObj.hiddenLayerSize &&
        dbNetworkObj.hiddenLayerSize !== undefined
          ? dbNetworkObj.hiddenLayerSize
          : 0;

      config.architecture = "seed";
      config.binaryMode = dbNetworkObj.binaryMode;
      config.inputsId = dbNetworkObj.inputsId;
      config.numInputs = dbNetworkObj.numInputs;
      config.seedNetworkId = dbNetworkObj.networkId;
      config.seedNetworkRes = dbNetworkObj.successRate;

      logger.info(PF + " | SEED NETWORK:      " + dbNetworkObj.networkId);
      logger.info(
        PF + " | SEED NETWORK TECH: " + dbNetworkObj.networkTechnology
      );
      logger.info(PF + " | SEED BINARY MODE:  " + dbNetworkObj.binaryMode);
      logger.info(PF + " | SEED HIDDEN NODES: " + dbNetworkObj.hiddenLayerSize);
      logger.info(PF + " | SEED INPUTS ID:    " + dbNetworkObj.inputsId);

      if (configuration.randomizeSeedOptions) {
        logger.info(
          PF + " | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId
        );
        config.activation = _.sample([
          config.activation,
          dbNetworkObj.evolve.options.activation,
        ]);
        config.cost = _.sample([config.cost, dbNetworkObj.evolve.options.cost]);
        config.elitism = _.sample([
          config.elitism,
          dbNetworkObj.evolve.options.elitism,
        ]);
        config.equal = _.sample([
          config.equal,
          dbNetworkObj.evolve.options.equal,
        ]);
        config.error = _.sample([
          config.error,
          dbNetworkObj.evolve.options.error,
        ]);
        config.errorThresh = _.sample([
          config.errorThresh,
          dbNetworkObj.evolve.options.errorThresh,
        ]);
        config.fitnessPopulation = _.sample([
          config.fitnessPopulation,
          dbNetworkObj.evolve.options.fitnessPopulation,
        ]);
        config.growth = _.sample([
          config.growth,
          dbNetworkObj.evolve.options.growth,
        ]);
        config.learningRate = _.sample([
          config.learningRate,
          dbNetworkObj.evolve.options.learningRate,
        ]);
        config.momentum = _.sample([
          config.momentum,
          dbNetworkObj.evolve.options.momentum,
        ]);
        config.mutationRate = _.sample([
          config.mutationRate,
          dbNetworkObj.evolve.options.mutationRate ||
            dbNetworkObj.evolve.options.mutationRate,
        ]);
        config.mutationAmount = _.sample([
          config.mutationAmount,
          dbNetworkObj.evolve.options.mutationAmount ||
            dbNetworkObj.evolve.options.mutationAmount,
        ]);
        config.selection = _.sample([
          config.selection,
          dbNetworkObj.evolve.options.selection,
        ]);
      } else {
        logger.info(
          PF + " | USE SEED NETWORK OPTIONS | " + config.seedNetworkId
        );
        config.activation = dbNetworkObj.evolve.options.activation;
        config.cost = dbNetworkObj.evolve.options.cost;
        config.elitism = dbNetworkObj.evolve.options.elitism;
        config.equal = dbNetworkObj.evolve.options.equal;
        config.error = dbNetworkObj.evolve.options.error;
        config.errorThresh = dbNetworkObj.evolve.options.errorThresh;
        config.growth = dbNetworkObj.evolve.options.growth;
        config.learningRate = dbNetworkObj.evolve.options.learningRate;
        config.momentum = dbNetworkObj.evolve.options.momentum;
        config.mutationRate =
          dbNetworkObj.evolve.options.mutationRate ||
          dbNetworkObj.evolve.options.mutationRate;
        config.mutationAmount =
          dbNetworkObj.evolve.options.mutationAmount ||
          dbNetworkObj.evolve.options.mutationAmount;
        config.selection =
          dbNetworkObj.evolve.options.selection ||
          dbNetworkObj.evolve.options.selection;
      }

      config = pickTechnologyOptions(config);
      return config;
    } catch (err) {
      logger.error(
        PF +
          " | *** SEED NETWORK ERROR | " +
          config.seedNetworkId +
          " | ERROR: " +
          err
      );
      throw new Error("SEED NETWORK ERROR: " + config.seedNetworkId);
    }
  }
  // not seed network
  else {
    if (config.seedInputsId && config.seedInputsId !== undefined) {
      logger.info(PF + " | USE SEED INPUTS ID | " + config.seedInputsId);

      try {
        let inputsObj;

        inputsObj = await global.wordAssoDb.NetworkInputs.findOne({
          inputsId: config.seedInputsId,
        })
          .lean()
          .exec();

        if (!inputsObj) {
          logger.error(
            PF +
              " | *** LOAD DB INPUTS ERROR | NOT FOUND" +
              " | INPUTS ID: " +
              config.seedInputsId
          );
          const file = config.seedInputsId + ".json";

          inputsObj = await loadInputsFile({
            folder: defaultInputsFolder,
            file: file,
          });
        }

        if (!inputsObj) {
          logger.error(
            "TNN | *** LOAD FILE INPUTS ERROR | NOT FOUND | INPUTS ID: " +
              config.seedInputsId
          );
          throw new Error(config.seedInputsId + " NOT IN inputsSet");
        }

        inputsSet.add(inputsObj.inputsId);

        config.inputsId = inputsObj.inputsId;

        const hiddenLayerSizeMax = Math.floor(
          configuration.evolve.inputsToHiddenLayerSizeRatio *
            inputsObj.meta.numInputs +
            3
        );

        logger.info(`inputsObj.meta.numInputs: ${inputsObj.meta.numInputs}`);
        logger.info(
          `configuration.evolve.inputsToHiddenLayerSizeRatio: ${configuration.evolve.inputsToHiddenLayerSizeRatio}`
        );
        logger.info(`hiddenLayerSizeMax: ${hiddenLayerSizeMax}`);

        // tensorflow always has hidden layer
        config.hiddenLayerSize =
          config.networkTechnology === "tensorflow"
            ? _.random(3, hiddenLayerSizeMax)
            : _.random(0, hiddenLayerSizeMax);

        config.architecture =
          config.hiddenLayerSize > 0 ? "perceptron" : "random";
        config.inputsId = config.seedInputsId;

        logger.info(
          `${PF} | ${config.architecture.toUpperCase()} ARCH | SEED INPUTS ID: ${
            config.seedInputsId
          } | HIDDEN LAYERS: ${config.hiddenLayerSize}`
        );

        config = pickTechnologyOptions(config);
        return config;
      } catch (err) {
        logger.error(
          PF +
            " | *** LOAD INPUTS ERROR" +
            " | INPUTS ID: " +
            config.seedInputsId +
            " | ERROR: " +
            err
        );
        throw new Error(config.seedInputsId + " NOT IN inputsSet");
      }
    } else {
      logger.info(
        PF +
          " | *** ERROR *** | PERCEPTRON ARCH | seedInputsId " +
          config.seedInputsId +
          " NOT IN inputsSet"
      );
      throw new Error(config.seedInputsId + " NOT IN inputsSet");
    }
  }
}

async function initNetworkCreate(params) {
  try {
    const childId = params.childId;
    const networkId = params.networkId;
    const compareTech =
      params.compareTech !== undefined
        ? params.compareTech
        : configuration.compareTech;

    statsObj.status = "INIT NETWORK CREATE";

    logger.info(
      PF +
        " | INIT NETWORK CREATE" +
        " | CHILD " +
        childId +
        " | NNC ID: " +
        networkId +
        " | COMPARE TECH: " +
        compareTech
    );

    logger.info(params);

    let messageObj;
    let networkCreateObj = {};

    let childConf;

    if (
      compareTech &&
      configuration.previousChildConfig &&
      configuration.enableRandomTechnology
    ) {
      childConf = configuration.previousChildConfig;

      if (
        configuration.previousChildConfig.networkTechnology === "tensorflow"
      ) {
        childConf.networkTechnology = "neataptic";
      }
      if (configuration.previousChildConfig.networkTechnology === "neataptic") {
        childConf.networkTechnology = "carrot";
      }
      if (configuration.previousChildConfig.networkTechnology === "carrot") {
        childConf.networkTechnology = "tensorflow";
      }

      logger.warn(
        "TNN | PREV CHILD CONF TECH: " +
          configuration.previousChildConfig.networkTechnology
      );
      logger.warn(
        "TNN | NEXT CHILD CONF TECH: " + configuration.networkTechnology
      );

      configuration.previousChildConfig = false;
    } else {
      childConf = await generateRandomEvolveConfig();
      configuration.previousChildConfig = childConf;
    }

    statsObj.status = "EVOLVE";

    messageObj = {};
    messageObj = childConf;

    messageObj.childId = childId;
    messageObj.op = "CONFIG_EVOLVE";
    messageObj.testRunId = networkId;
    messageObj.outputs = [];
    messageObj.outputs = ["left", "neutral", "right"];

    messageObj.betterChild = false;

    messageObj.seedNetworkId =
      messageObj.seedNetworkId &&
      messageObj.seedNetworkId !== undefined &&
      messageObj.seedNetworkId !== "false"
        ? messageObj.seedNetworkId
        : false;
    messageObj.seedNetworkRes =
      messageObj.seedNetworkRes !== undefined &&
      messageObj.seedNetworkRes !== "false"
        ? messageObj.seedNetworkRes
        : 0;

    // if (messageObj.seedNetworkId){
    //   messageObj.logScaleMode = (messageObj.logScaleMode !== undefined) ? messageObj.logScaleMode : configuration.logScaleMode;
    // }

    logger.info("\nTNN | START NETWORK EVOLVE");

    logger.info(
      PF +
        " | NN ID:             " +
        networkId +
        "\n" +
        PF +
        " | TECHNOLOGY:        " +
        messageObj.networkTechnology +
        "\n" +
        PF +
        " | BIN MODE:          " +
        messageObj.binaryMode +
        "\n" +
        PF +
        " | ARCHITECTURE:      " +
        messageObj.architecture +
        "\n" +
        PF +
        " | INPUTS ID:         " +
        messageObj.inputsId +
        "\n" +
        PF +
        " | INPUTS:            " +
        messageObj.numInputs +
        "\n" +
        PF +
        " | HIDDEN LAYER SIZE: " +
        messageObj.hiddenLayerSize +
        "\n" +
        PF +
        " | ITERATIONS:        " +
        messageObj.iterations +
        "\n" +
        PF +
        " | ERROR:             " +
        messageObj.error
    );

    if (messageObj.networkTechnology !== "tensorflow") {
      logger.info(PF + " | ACTIVATION:        " + messageObj.activation);
    }

    if (messageObj.networkTechnology === "tensorflow") {
      //       network.compile({
      //   optimizer: 'sgd',
      //   loss: 'categoricalCrossentropy',
      //   metrics: ['accuracy']
      // });
      logger.info(
        PF +
          " | OPTIMIZER:         " +
          messageObj.optimizer +
          "\n" +
          PF +
          " | INPUT ACTIVATION:  " +
          messageObj.inputActivation +
          "\n" +
          PF +
          " | OUTPUT ACTIVATION: " +
          messageObj.outputActivation +
          "\n" +
          PF +
          " | LOSS:              " +
          messageObj.loss +
          "\n" +
          PF +
          " | METRICS:           " +
          messageObj.metrics
      );
    }

    if (messageObj.networkTechnology !== "tensorflow") {
      logger.info(
        PF +
          " | COST:              " +
          messageObj.cost +
          "\n" +
          PF +
          " | SELECTION:         " +
          messageObj.selection +
          "\n" +
          PF +
          " | EFF MUTATION:      " +
          messageObj.efficientMutation
      );
    }

    if (messageObj.seedNetworkId) {
      logger.info(
        PF +
          " | SEED:                " +
          messageObj.seedNetworkId +
          " | SR: " +
          messageObj.seedNetworkRes.toFixed(3) +
          "%"
      );
      logger.info(
        PF + " | BETTER CHILD SEED:   " + messageObj.isBetterChildSeed
      );
    } else {
      logger.info(PF + " | SEED:                ----");
    }

    resultsHashmap[messageObj.testRunId] = {};

    networkCreateObj = {};
    networkCreateObj.childId = childId;
    networkCreateObj.status = "EVOLVE";
    networkCreateObj.binaryMode = messageObj.binaryMode;
    // networkCreateObj.logScaleMode = messageObj.logScaleMode;
    networkCreateObj.successRate = 0;
    networkCreateObj.matchRate = 0;
    networkCreateObj.overallMatchRate = 0;
    networkCreateObj.runtimeMatchRate = 0;
    networkCreateObj.networkId = messageObj.testRunId;
    networkCreateObj.networkTechnology = messageObj.networkTechnology;
    networkCreateObj.hiddenLayerSize = messageObj.hiddenLayerSize;
    networkCreateObj.betterChild = false;
    networkCreateObj.seedNetworkId = messageObj.seedNetworkId;
    networkCreateObj.seedNetworkRes = messageObj.seedNetworkRes;
    networkCreateObj.numInputs = messageObj.numInputs;
    networkCreateObj.inputsId = messageObj.inputsId;
    networkCreateObj.evolve = {};
    networkCreateObj.evolve.startTime = moment().valueOf();
    networkCreateObj.evolve.endTime = moment().valueOf();
    networkCreateObj.evolve.complete = false;
    networkCreateObj.evolve.options = {};
    networkCreateObj.evolve.options = pick(
      childConf,
      combinedEvolveOptionsPickArray
    );

    resultsHashmap[messageObj.testRunId] = networkCreateObj;

    await printResultsHashmap();
    await childSend({ command: messageObj });

    logger.info(PF + " | END initNetworkCreate");
    return;
  } catch (err) {
    logger.error(PF + " | INIT CREATE NETWORK ERROR ", err);
    throw err;
  }
}

//=========================================================================
//=========================================================================
//const MODULE_ID = PF + "_node_" + hostname;

process.title = MODULE_ID.toLowerCase() + "_" + process.pid;

process.on("exit", function (code, signal) {
  logger.info(
    PF +
      " | PROCESS EXIT" +
      " | " +
      getTimeStamp() +
      " | " +
      `CODE: ${code}` +
      " | " +
      `SIGNAL: ${signal}`
  );
});

process.on("close", function (code, signal) {
  logger.info(
    PF +
      " | PROCESS CLOSE" +
      " | " +
      getTimeStamp() +
      " | " +
      `CODE: ${code}` +
      " | " +
      `SIGNAL: ${signal}`
  );
});

process.on("SIGHUP", function (code, signal) {
  logger.info(
    PF +
      " | PROCESS SIGHUP" +
      " | " +
      getTimeStamp() +
      " | " +
      `CODE: ${code}` +
      " | " +
      `SIGNAL: ${signal}`
  );
  quit({ cause: "SIGHUP" });
});

process.on("SIGINT", function (code, signal) {
  logger.info(
    PF +
      " | PROCESS SIGINT" +
      " | " +
      getTimeStamp() +
      " | " +
      `CODE: ${code}` +
      " | " +
      `SIGNAL: ${signal}`
  );
  quit({ cause: "SIGINT" });
});

process.on("unhandledRejection", function (err, promise) {
  logger.info(
    PF + " | *** Unhandled rejection (promise: ",
    promise,
    ", reason: ",
    err,
    ")."
  );
  quit({ cause: "unhandledRejection" });
  process.exit(1);
});

//=========================================================================
// CONFIGURATION
//=========================================================================
let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

configuration.slackChannel = {};

async function initWatchAllConfigFolders(p) {
  try {
    const params = p || {};

    logger.info(params);

    await loadAllConfigFiles();
    await loadNetworkInputsConfig({ file: defaultBestInputsConfigFile });
    await loadNetworkInputsConfig({ file: defaultNetworkInputsConfigFile });
    await loadNetworkInputsConfig({ file: defaultUnionInputsConfigFile });
    await loadCommandLineArgs();

    const options = {
      ignoreDotFiles: true,
      ignoreUnreadableDir: true,
      ignoreNotPermitted: true,
    };

    //========================
    // WATCH GLOBAL NETWORKS
    //========================

    watch.createMonitor(
      globalBestNetworkFolder,
      options,
      function (monitorNetworks) {
        logger.info(
          PF +
            " | INIT WATCH GLOBAL NETWORKS FOLDER: " +
            globalBestNetworkFolder
        );

        monitorNetworks.on("created", async function (f) {
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length - 1];
          if (
            !fileNameArray.includes("archive") &&
            file.endsWith(".json") &&
            !file.startsWith("bestRuntimeNetwork")
          ) {
            logger.info(PF + " | +++ NETWORK FILE CREATED: " + f);
            try {
              await delay({ period: 30 * ONE_SECOND });
              await loadNetworkFile({
                folder: globalBestNetworkFolder,
                file: file,
              });
            } catch (err) {
              logger.info(
                PF +
                  " | *** LOAD NETWORK FILE CREATED ERROR | " +
                  f +
                  ": " +
                  err
              );
            }
          }
        });

        monitorNetworks.on("changed", async function (f) {
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length - 1];
          if (
            !fileNameArray.includes("archive") &&
            file.endsWith(".json") &&
            !file.startsWith("bestRuntimeNetwork")
          ) {
            logger.info(PF + " | -/- NETWORK FILE CHANGED: " + f);
            try {
              await delay({ period: 30 * ONE_SECOND });
              await loadNetworkFile({
                folder: globalBestNetworkFolder,
                file: file,
              });
            } catch (err) {
              logger.info(
                PF +
                  " | *** LOAD NETWORK FILE CREATED ERROR | " +
                  f +
                  ": " +
                  err
              );
            }
          }
        });

        monitorNetworks.on("removed", function (f) {
          const fileNameArray = f.split("/");
          const networkId = fileNameArray[fileNameArray.length - 1].replace(
            ".json",
            ""
          );
          logger.info(
            PF +
              " | XXX NETWORK FILE DELETED | " +
              getTimeStamp() +
              " | " +
              networkId +
              "\n" +
              f
          );
          viableNetworkIdSet.delete(networkId);
        });
      }
    );

    //========================
    // WATCH LOCAL NETWORKS
    //========================

    watch.createMonitor(
      localBestNetworkFolder,
      options,
      function (monitorNetworks) {
        logger.info(
          PF + " | INIT WATCH LOCAL NETWORKS FOLDER: " + localBestNetworkFolder
        );

        monitorNetworks.on("created", async function (f) {
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length - 1];
          if (
            !fileNameArray.includes("archive") &&
            file.endsWith(".json") &&
            !file.startsWith("bestRuntimeNetwork")
          ) {
            logger.info(PF + " | +++ LOCAl NETWORK FILE CREATED: " + f);
            try {
              await delay({ period: 30 * ONE_SECOND });
              await loadNetworkFile({
                folder: localBestNetworkFolder,
                file: file,
              });
            } catch (err) {
              logger.info(
                PF +
                  " | *** LOAD LOCAL NETWORK FILE CREATED ERROR | " +
                  f +
                  ": " +
                  err
              );
            }
          }
        });

        monitorNetworks.on("changed", async function (f) {
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length - 1];
          if (
            !fileNameArray.includes("archive") &&
            file.endsWith(".json") &&
            !file.startsWith("bestRuntimeNetwork")
          ) {
            logger.info(PF + " | -/- LOCAL NETWORK FILE CHANGED: " + f);
            try {
              await delay({ period: 30 * ONE_SECOND });
              await loadNetworkFile({
                folder: localBestNetworkFolder,
                file: file,
              });
            } catch (err) {
              logger.error(
                PF +
                  " | *** LOAD LOCAL NETWORK FILE CREATED ERROR | " +
                  f +
                  ": " +
                  err
              );
            }
          }
        });

        monitorNetworks.on("removed", function (f) {
          const fileNameArray = f.split("/");
          const networkId = fileNameArray[fileNameArray.length - 1].replace(
            ".json",
            ""
          );
          logger.info(
            PF +
              " | XXX LOCAL NETWORK FILE DELETED | " +
              getTimeStamp() +
              " | " +
              networkId +
              "\n" +
              f
          );

          viableNetworkIdSet.delete(networkId);
        });
      }
    );

    //========================
    // WATCH INPUTS
    //========================

    watch.createMonitor(defaultInputsFolder, options, function (monitorInputs) {
      logger.info(
        PF + " | INIT WATCH INPUTS CONFIG FOLDER: " + defaultInputsFolder
      );

      monitorInputs.on("created", async function (f) {
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length - 1];
        if (file.startsWith("inputs_")) {
          logger.info(PF + " | +++ INPUTS FILE CREATED: " + f);
          try {
            await delay({ period: 30 * ONE_SECOND });
            await loadInputsFile({ folder: defaultInputsFolder, file: file });
          } catch (err) {
            logger.error(
              PF + " | *** LOAD INPUTS FILE CREATED ERROR | " + f + ": " + err
            );
          }
        }
      });

      monitorInputs.on("changed", async function (f) {
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length - 1];
        if (file.startsWith("inputs_")) {
          logger.info(PF + " | -/- INPUTS FILE CHANGED: " + f);
          try {
            await delay({ period: 30 * ONE_SECOND });
            await loadInputsFile({ folder: defaultInputsFolder, file: file });
          } catch (err) {
            logger.error(
              PF + " | *** LOAD INPUTS FILE CHANGED ERROR | " + f + ": " + err
            );
          }
        }
      });

      monitorInputs.on("removed", function (f) {
        const fileNameArray = f.split("/");
        const inputsId = fileNameArray[fileNameArray.length - 1].replace(
          ".json",
          ""
        );
        logger.info(
          PF +
            " | XXX INPUTS FILE DELETED | " +
            getTimeStamp() +
            " | " +
            inputsId +
            " | " +
            f
        );
        inputsSet.delete(inputsId);
      });
    });

    //========================
    // WATCH DEFAULT CONFIG
    //========================

    watch.createMonitor(
      configDefaultFolder,
      options,
      function (monitorDefaultConfig) {
        logger.info(
          PF + " | INIT WATCH DEFAULT CONFIG FOLDER: " + configDefaultFolder
        );

        monitorDefaultConfig.on("created", async function (f) {
          if (f.endsWith(configDefaultFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }

          if (f.endsWith(defaultBestInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultBestInputsConfigFile,
            });
          }

          if (f.endsWith(defaultNetworkInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultNetworkInputsConfigFile,
            });
          }

          if (f.endsWith(defaultUnionInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultUnionInputsConfigFile,
            });
          }

          if (f.endsWith(defaultZeroSuccessEvolveOptionsFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await initZeroSuccessEvolveOptionsSet();
          }
        });

        monitorDefaultConfig.on("changed", async function (f) {
          if (f.endsWith(configDefaultFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }

          if (f.endsWith(defaultBestInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultBestInputsConfigFile,
            });
          }

          if (f.endsWith(defaultNetworkInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultNetworkInputsConfigFile,
            });
          }

          if (f.endsWith(defaultUnionInputsConfigFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await loadNetworkInputsConfig({
              file: defaultUnionInputsConfigFile,
            });
          }

          if (f.endsWith(defaultZeroSuccessEvolveOptionsFile)) {
            await delay({ period: 30 * ONE_SECOND });
            await initZeroSuccessEvolveOptionsSet();
          }
        });

        monitorDefaultConfig.on("removed", function (f) {
          debug(PF + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f);
        });
      }
    );

    //========================
    // WATCH HOST CONFIG
    //========================

    watch.createMonitor(
      configHostFolder,
      options,
      function (monitorHostConfig) {
        logger.info(
          PF + " | INIT WATCH HOST CONFIG FOLDER: " + configHostFolder
        );

        monitorHostConfig.on("created", async function (f) {
          if (f.endsWith(configHostFile)) {
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }
        });

        monitorHostConfig.on("changed", async function (f) {
          if (f.endsWith(configHostFile)) {
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }
        });

        monitorHostConfig.on("removed", function (f) {
          debug(PF + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f);
        });
      }
    );

    return;
  } catch (err) {
    logger.error(PF + " | *** INIT LOAD ALL CONFIG INTERVAL ERROR: " + err);
    throw err;
  }
}

async function initConfig(cnf) {
  try {
    statsObj.status = "INIT CONFIG";

    logger.info(PF + " | INIT CONFIG");

    if (debug.enabled) {
      logger.info(
        "\nTNN | %%%%%%%%%%%%%%\nTNN |  DEBUG ENABLED \nTNN | %%%%%%%%%%%%%%\n"
      );
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = process.env.TEST_MODE === "true" ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
    cnf.enableStdin = process.env.ENABLE_STDIN || true;

    if (process.env.QUIT_ON_COMPLETE === "false") {
      cnf.quitOnComplete = false;
    } else if (
      process.env.QUIT_ON_COMPLETE === true ||
      process.env.QUIT_ON_COMPLETE === "true"
    ) {
      cnf.quitOnComplete = true;
    }

    await initWatchAllConfigFolders();

    const configArgs = Object.keys(configuration);

    configArgs.forEach(function (arg) {
      if (arg === "inputsIdArray") {
        logger.info(
          PF +
            " | _FINAL CONFIG | " +
            arg +
            ": " +
            configuration[arg].length +
            " INPUT IDS"
        );
      } else if (_.isObject(configuration[arg])) {
        logger.info(
          PF +
            " | _FINAL CONFIG | " +
            arg +
            "\n" +
            jsonPrint(configuration[arg])
        );
      } else {
        logger.info(
          PF + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]
        );
      }
    });

    statsObj.commandLineArgsLoaded = true;

    if (configuration.enableStdin) {
      initStdIn();
    }

    await initStatsUpdate();

    return configuration;
  } catch (err) {
    logger.error(PF + " | *** CONFIG LOAD ERROR: " + err);
    throw err;
  }
}

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================

function getElapsedTimeStamp() {
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function touchChildPidFile(params) {
  return new Promise(function (resolve, reject) {
    try {
      const childPidFile = params.childId + "=" + params.pid;

      const folder = params.folder || childPidFolderLocal;

      shell.mkdir("-p", folder);

      const path = folder + "/" + childPidFile;

      touch.sync(path, { force: true });

      logger.info(PF + " | TOUCH CHILD PID FILE: " + path);
      resolve(path);
    } catch (err) {
      return reject(err);
    }
  });
}

function getChildProcesses() {
  return new Promise(function (resolve, reject) {
    const childPidArray = [];

    shell.mkdir("-p", childPidFolderLocal);

    logger.info("SHELL: cd " + childPidFolderLocal);
    shell.cd(childPidFolderLocal);

    const childPidFileNameArray = shell.ls(configuration.childIdPrefix + "*");

    async.eachSeries(
      childPidFileNameArray,
      function (childPidFileName, cb) {
        logger.info("SHELL: childPidFileName: " + childPidFileName);

        const childPidStringArray = childPidFileName.split("=");

        const childId = childPidStringArray[0];
        const childPid = parseInt(childPidStringArray[1]);

        logger.info("SHELL: CHILD ID: " + childId + " | PID: " + childPid);

        if (childHashMap[childId]) {
          debug(
            "CHILD HM HIT" +
              " | ID: " +
              childId +
              " | SHELL PID: " +
              childPid +
              " | HM PID: " +
              childHashMap[childId].pid +
              " | STATUS: " +
              childHashMap[childId].status
          );
        } else {
          logger.info(
            "CHILD HM MISS | ID: " +
              childId +
              " | PID: " +
              childPid +
              " | STATUS: UNKNOWN"
          );
        }

        if (
          childHashMap[childId] !== undefined &&
          childHashMap[childId].pid === childPid
        ) {
          childPidArray.push({ pid: childPid, childId: childId });

          logger.info(
            PF +
              " | FOUND CHILD" +
              " [ " +
              childPidArray.length +
              " CHILDREN ]" +
              " | ID: " +
              childId +
              " | PID: " +
              childPid +
              " | FILE: " +
              childPidFileName
          );

          cb();
        } else {
          logger.info(
            "SHELL: CHILD NOT IN HASH | ID: " + childId + " | PID: " + childPid
          );

          if (empty(childHashMap[childId])) {
            logger.info(PF + " | *** CHILD NOT IN HM" + " | " + childId);
          } else if (childHashMap[childId].pid !== childPid) {
            logger.info(
              PF +
                " | *** CHILD PID HM MISMATCH" +
                " | " +
                childId +
                " | HM PID: " +
                childHashMap[childId].pid +
                " | PID: " +
                childPid
            );
          }

          logger.info(
            PF + " | *** CHILD ZOMBIE" + " | " + childId + " | TERMINATING ..."
          );

          kill(childPid, function (err) {
            if (err) {
              logger.error(PF + " | *** KILL ZOMBIE ERROR: ", err);
              return cb(err);
            }

            shell.cd(childPidFolderLocal);
            shell.rm(childId + "*");

            delete childHashMap[childId];

            logger.info(
              PF +
                " | XXX CHILD ZOMBIE" +
                " [ " +
                childPidArray.length +
                " CHILDREN ]" +
                " | ID: " +
                childId +
                " | PID: " +
                childPid
            );

            cb();
          });
        }
      },
      function (err) {
        if (err) {
          return reject(err);
        }

        resolve(childPidArray);
      }
    );
  });
}

function killChild(params) {
  return new Promise(function (resolve, reject) {
    let pid;

    if (params.pid === undefined && empty(childHashMap[params.childId])) {
      return reject(new Error("CHILD ID NOT FOUND: " + params.childId));
    }

    if (params.pid) {
      pid = params.pid;
    } else if (params.childId && childHashMap[params.childId] !== undefined) {
      pid = childHashMap[params.childId].pid;
    }

    kill(pid, function (err) {
      if (err) {
        return reject(err);
      }
      resolve(params);
    });
  });
}

async function killAll() {
  logger.info("KILL ALL");

  const childPidArray = await getChildProcesses({
    searchTerm: configuration.childIdPrefix,
  });

  logger.info(childPidArray);
  if (childPidArray && childPidArray.length > 0) {
    async.eachSeries(
      childPidArray,
      function (childObj, cb) {
        killChild({ pid: childObj.pid })
          .then(function () {
            logger.info(
              PF +
                " | KILL ALL | KILLED | PID: " +
                childObj.pid +
                " | CH ID: " +
                childObj.childId
            );
            cb();
          })
          .catch(function (err) {
            logger.error(
              PF +
                " | *** KILL CHILD ERROR" +
                " | PID: " +
                childObj.pid +
                " | ERROR: " +
                err
            );
            return cb(err);
          });
      },
      function (err) {
        if (err) {
          throw err;
        }

        return childPidArray;
      }
    );
  } else {
    logger.info(PF + " | KILL ALL | NO CHILDREN");
    return childPidArray;
  }
}

//=========================================================================
// STATS
//=========================================================================

async function showStats(options) {
  statsObj.elapsed = getElapsedTimeStamp();

  await childStatsAll();
  await printResultsHashmap();

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    logger.info(PF + " | STATS\n" + jsonPrint(statsObjSmall));
    return;
  } else {
    Object.keys(childHashMap).forEach(function (childId) {
      logger.info(
        PF +
          " | STATUS CHILD" +
          " | CHILD ID: " +
          childId +
          " | CH FSM: " +
          childHashMap[childId].status
      );

      objectPath.set(
        statsObj,
        ["children", childId, "status"],
        childHashMap[childId].status
      );
    });

    logger.info(
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
    );

    return;
  }
}

function initStatsUpdate() {
  return new Promise(function (resolve, reject) {
    try {
      logger.info(
        PF +
          " | INIT STATS UPDATE INTERVAL | " +
          msToTime(configuration.statsUpdateIntervalTime)
      );

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      tcUtils.saveFile({ folder: statsFolder, file: statsFile, obj: statsObj });

      clearInterval(statsUpdateInterval);

      statsUpdateInterval = setInterval(async function () {
        statsObj.elapsed = getElapsedTimeStamp();
        statsObj.timeStamp = getTimeStamp();

        saveFileQueue.push({
          folder: statsFolder,
          file: statsFile,
          obj: statsObj,
        });
        statsObj.queues.saveFileQueue.size = saveFileQueue.length;

        try {
          await showStats();
        } catch (err) {
          logger.error(PF + " | *** SHOW STATS ERROR: " + err);
        }
      }, configuration.statsUpdateIntervalTime);

      resolve();
    } catch (err) {
      logger.error(PF + " | *** initStatsUpdate ERROR:", err);
      reject(err);
    }
  });
}

async function loadConfigFile(params) {
  let fullPath;

  try {
    fullPath = path.join(params.folder, params.file);

    if (configuration.offlineMode) {
      await loadCommandLineArgs();
      return;
    }

    const newConfiguration = {};
    newConfiguration.evolve = {};

    const loadedConfigObj = await tcUtils.loadFile({
      folder: params.folder,
      file: params.file,
      noErrorNotFound: params.noErrorNotFound,
    });

    if (loadedConfigObj === undefined) {
      if (params.noErrorNotFound) {
        logger.info(
          PF +
            " | ... SKIP LOAD CONFIG FILE: " +
            params.folder +
            "/" +
            params.file
        );
        return newConfiguration;
      } else {
        logger.error(
          PF + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "
        );
        throw new Error("JSON UNDEFINED");
      }
    }

    if (loadedConfigObj instanceof Error) {
      logger.info(
        PF + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj
      );
    }

    logger.info(
      PF +
        " | LOADED CONFIG FILE: " +
        params.file +
        "\n" +
        jsonPrint(loadedConfigObj)
    );

    if (loadedConfigObj.TNN_DATA_ROOT_FOLDER !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_DATA_ROOT_FOLDER: " +
          loadedConfigObj.TNN_DATA_ROOT_FOLDER
      );
      newConfiguration.defaultDataRoot = loadedConfigObj.TNN_DATA_ROOT_FOLDER;
    }

    if (loadedConfigObj.TNN_NETWORK_TECHNOLOGY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_NETWORK_TECHNOLOGY: " +
          loadedConfigObj.TNN_NETWORK_TECHNOLOGY
      );
      newConfiguration.networkTechnology =
        loadedConfigObj.TNN_NETWORK_TECHNOLOGY;
    }

    if (loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_FORCE_LOAD_TRAINING_SET: " +
          loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET
      );
      if (
        loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET === true ||
        loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET === "true"
      ) {
        newConfiguration.forceLoadTrainingSet = true;
      }
      if (
        loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET === false ||
        loadedConfigObj.TNN_FORCE_LOAD_TRAINING_SET === "false"
      ) {
        newConfiguration.forceLoadTrainingSet = false;
      }
    }

    if (loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EQUAL_CATEGORIES_FLAG: " +
          loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG
      );
      if (
        loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG === true ||
        loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG === "true"
      ) {
        newConfiguration.equalCategoriesFlag = true;
      }
      if (
        loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG === false ||
        loadedConfigObj.TNN_EQUAL_CATEGORIES_FLAG === "false"
      ) {
        newConfiguration.equalCategoriesFlag = false;
      }
    }

    if (loadedConfigObj.TNN_EVOLVE_TIMEOUT_DURATION !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_TIMEOUT_DURATION: " +
          loadedConfigObj.TNN_EVOLVE_TIMEOUT_DURATION
      );
      newConfiguration.evolveTimeoutDuration =
        loadedConfigObj.TNN_EVOLVE_TIMEOUT_DURATION;
    }

    if (loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS: " +
          loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS
      );
      if (
        loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS === true ||
        loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS === "true"
      ) {
        newConfiguration.enableZeroSuccessEvolveOptions = true;
      }
      if (
        loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS === false ||
        loadedConfigObj.TNN_ENABLE_ZERO_SUCCESS_EVOLVE_OPTIONS === "false"
      ) {
        newConfiguration.enableZeroSuccessEvolveOptions = false;
      }
    }

    if (loadedConfigObj.TNN_MAX_FRIENDS !== undefined) {
      logger.info(
        PF + " | LOADED TNN_MAX_FRIENDS: " + loadedConfigObj.TNN_MAX_FRIENDS
      );
      newConfiguration.maxFriends = loadedConfigObj.TNN_MAX_FRIENDS;
      childConfiguration.maxFriends = newConfiguration.maxFriends;
    }

    if (loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY: " +
          loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY
      );
      if (
        loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === true ||
        loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === "true"
      ) {
        newConfiguration.enableRandomTechnology = true;
      }
      if (
        loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === false ||
        loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === "false"
      ) {
        newConfiguration.enableRandomTechnology = false;
      }
    }

    if (
      loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL !== undefined
    ) {
      logger.info(
        PF +
          " | LOADED TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL: " +
          loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL
      );
      if (
        loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL === true ||
        loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL === "true"
      ) {
        newConfiguration.removeSeedFromViableNetworkOnFail = true;
      }
      if (
        loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL === false ||
        loadedConfigObj.TNN_REMOVE_SEED_FROM_VIABLE_NN_SET_ON_FAIL === "false"
      ) {
        newConfiguration.removeSeedFromViableNetworkOnFail = false;
      }
    }

    if (loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_USER_PROFILE_ONLY_FLAG: " +
          loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG
      );
      if (
        loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG === true ||
        loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG === "true"
      ) {
        newConfiguration.userProfileOnlyFlag = true;
      }
      if (
        loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG === false ||
        loadedConfigObj.TNN_USER_PROFILE_ONLY_FLAG === "false"
      ) {
        newConfiguration.userProfileOnlyFlag = false;
      }

      childConfiguration.userProfileOnlyFlag =
        newConfiguration.userProfileOnlyFlag;
    }

    if (loadedConfigObj.TNN_BINARY_MODE !== undefined) {
      logger.info(
        PF + " | LOADED TNN_BINARY_MODE: " + loadedConfigObj.TNN_BINARY_MODE
      );
      if (
        loadedConfigObj.TNN_BINARY_MODE === true ||
        loadedConfigObj.TNN_BINARY_MODE === "true"
      ) {
        newConfiguration.binaryMode = true;
      }
      if (
        loadedConfigObj.TNN_BINARY_MODE === false ||
        loadedConfigObj.TNN_BINARY_MODE === "false"
      ) {
        newConfiguration.binaryMode = false;
      }

      childConfiguration.binaryMode = newConfiguration.binaryMode;
    }

    if (loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_ENABLE_RANDOM_BINARY_MODE: " +
          loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE
      );
      if (
        loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE === true ||
        loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE === "true"
      ) {
        newConfiguration.enableRandomBinaryMode = true;
      }
      if (
        loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE === false ||
        loadedConfigObj.TNN_ENABLE_RANDOM_BINARY_MODE === "false"
      ) {
        newConfiguration.enableRandomBinaryMode = false;
      }
    }

    if (loadedConfigObj.TNN_BINARY_MODE_PROBABILITY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_BINARY_MODE_PROBABILITY: " +
          loadedConfigObj.TNN_BINARY_MODE_PROBABILITY
      );
      newConfiguration.evolve.binaryModeProbability =
        loadedConfigObj.TNN_BINARY_MODE_PROBABILITY;
    }

    if (loadedConfigObj.TNN_COMPARE_TECH !== undefined) {
      logger.info(
        PF + " | LOADED TNN_COMPARE_TECH: " + loadedConfigObj.TNN_COMPARE_TECH
      );
      if (
        loadedConfigObj.TNN_COMPARE_TECH === true ||
        loadedConfigObj.TNN_COMPARE_TECH === "true"
      ) {
        newConfiguration.compareTech = true;
      }
      if (
        loadedConfigObj.TNN_COMPARE_TECH === false ||
        loadedConfigObj.TNN_COMPARE_TECH === "false"
      ) {
        newConfiguration.compareTech = false;
      }
    }

    if (loadedConfigObj.TNN_TEST_MODE !== undefined) {
      logger.info(
        PF + " | LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE
      );
      if (
        loadedConfigObj.TNN_TEST_MODE === true ||
        loadedConfigObj.TNN_TEST_MODE === "true"
      ) {
        newConfiguration.testMode = true;
      }
      if (
        loadedConfigObj.TNN_TEST_MODE === false ||
        loadedConfigObj.TNN_TEST_MODE === "false"
      ) {
        newConfiguration.testMode = false;
      }
    }

    if (loadedConfigObj.TNN_QUIT_ON_COMPLETE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_QUIT_ON_COMPLETE: " +
          loadedConfigObj.TNN_QUIT_ON_COMPLETE
      );
      if (
        loadedConfigObj.TNN_QUIT_ON_COMPLETE === true ||
        loadedConfigObj.TNN_QUIT_ON_COMPLETE === "true"
      ) {
        newConfiguration.quitOnComplete = true;
      }
      if (
        loadedConfigObj.TNN_QUIT_ON_COMPLETE === false ||
        loadedConfigObj.TNN_QUIT_ON_COMPLETE === "false"
      ) {
        newConfiguration.quitOnComplete = false;
      }
    }

    if (loadedConfigObj.TNN_PURGE_MIN !== undefined) {
      logger.info(
        PF + " | LOADED TNN_PURGE_MIN: " + loadedConfigObj.TNN_PURGE_MIN
      );
      if (
        loadedConfigObj.TNN_PURGE_MIN === true ||
        loadedConfigObj.TNN_PURGE_MIN === "true"
      ) {
        newConfiguration.purgeMin = true;
      }
      if (
        loadedConfigObj.TNN_PURGE_MIN === false ||
        loadedConfigObj.TNN_PURGE_MIN === "false"
      ) {
        newConfiguration.purgeMin = false;
      }
    }

    if (loadedConfigObj.VERBOSE !== undefined) {
      logger.info(PF + " | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
      if (
        loadedConfigObj.VERBOSE === true ||
        loadedConfigObj.VERBOSE === "true"
      ) {
        newConfiguration.verbose = true;
      }
      if (
        loadedConfigObj.VERBOSE === false ||
        loadedConfigObj.VERBOSE === "false"
      ) {
        newConfiguration.verbose = false;
      }
    }

    if (loadedConfigObj.TNN_TEST_SET_RATIO !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_TEST_SET_RATIO: " +
          loadedConfigObj.TNN_TEST_SET_RATIO
      );
      newConfiguration.testSetRatio = loadedConfigObj.TNN_TEST_SET_RATIO;
    }

    if (loadedConfigObj.TNN_VIABLE_NETWORK_TECHNOLOGY_ARRAY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_VIABLE_NETWORK_TECHNOLOGY_ARRAY: " +
          loadedConfigObj.TNN_VIABLE_NETWORK_TECHNOLOGY_ARRAY
      );
      newConfiguration.viableNetworkTechArray =
        loadedConfigObj.TNN_VIABLE_NETWORK_TECHNOLOGY_ARRAY;
    }

    if (loadedConfigObj.ENABLE_STDIN !== undefined) {
      logger.info(
        PF + " | LOADED ENABLE_STDIN: " + loadedConfigObj.ENABLE_STDIN
      );
      newConfiguration.enableStdin = loadedConfigObj.ENABLE_STDIN;
    }

    if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " +
          loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN
      );
      newConfiguration.maxNumberChildren =
        loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
    }

    if (loadedConfigObj.TNN_MIN_PASS_RATIO !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_MIN_PASS_RATIO: " +
          loadedConfigObj.TNN_MIN_PASS_RATIO
      );
      newConfiguration.minPassRatio = loadedConfigObj.TNN_MIN_PASS_RATIO;
    }

    if (loadedConfigObj.TNN_MAX_FAIL_NETWORKS !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_MAX_FAIL_NETWORKS: " +
          loadedConfigObj.TNN_MAX_FAIL_NETWORKS
      );
      newConfiguration.maxFailNetworks = loadedConfigObj.TNN_MAX_FAIL_NETWORKS;
    }

    if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_SEED_NETWORK_PROBABILITY: " +
          loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY
      );
      newConfiguration.seedNetworkProbability =
        loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
    }

    if (loadedConfigObj.TNN_GLOBAL_VIABLE_SUCCESS_RATE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_GLOBAL_VIABLE_SUCCESS_RATE: " +
          loadedConfigObj.TNN_GLOBAL_VIABLE_SUCCESS_RATE
      );
      newConfiguration.globalViableSuccessRate =
        loadedConfigObj.TNN_GLOBAL_VIABLE_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE
      );
      newConfiguration.globalMinSuccessRate =
        loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE
      );
      newConfiguration.localMinSuccessRate =
        loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_HOST_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE
      );
      newConfiguration.hostMinSuccessRate =
        loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE_MSE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_HOST_MIN_SUCCESS_RATE_MSE: " +
          loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE_MSE
      );
      newConfiguration.hostMinSuccessRateMSE =
        loadedConfigObj.TNN_HOST_MIN_SUCCESS_RATE_MSE;
    }

    if (loadedConfigObj.TNN_HOST_PURGE_MIN_SUCCESS_RATE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_HOST_PURGE_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TNN_HOST_PURGE_MIN_SUCCESS_RATE
      );
      newConfiguration.hostPurgeMinSuccessRate =
        loadedConfigObj.TNN_HOST_PURGE_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_INPUTS_IDS !== undefined) {
      logger.info(
        PF + " | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS
      );
      newConfiguration.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
    }

    // EVOLVE CONFIG

    if (loadedConfigObj.TNN_RANDOM_EVOLVE_TECH_ARRAY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_RANDOM_EVOLVE_TECH_ARRAY: " +
          loadedConfigObj.TNN_RANDOM_EVOLVE_TECH_ARRAY
      );
      newConfiguration.evolve.randomEvolveTechArray =
        loadedConfigObj.TNN_RANDOM_EVOLVE_TECH_ARRAY;
    }

    if (
      loadedConfigObj.TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO !== undefined
    ) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO: " +
          loadedConfigObj.TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO
      );
      newConfiguration.evolve.inputsToHiddenLayerSizeRatio =
        loadedConfigObj.TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO;
    }

    if (loadedConfigObj.TNN_EVOLVE_POPSIZE !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_POPSIZE: " +
          loadedConfigObj.TNN_EVOLVE_POPSIZE
      );
      newConfiguration.evolve.popsize = loadedConfigObj.TNN_EVOLVE_POPSIZE;
    }

    if (loadedConfigObj.TNN_EVOLVE_COST_ARRAY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_COST_ARRAY: " +
          loadedConfigObj.TNN_EVOLVE_COST_ARRAY
      );
      newConfiguration.evolve.costArray = loadedConfigObj.TNN_EVOLVE_COST_ARRAY;
    }

    if (loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_SELECTION_ARRAY: " +
          loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY
      );
      newConfiguration.evolve.selectionArray =
        loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY;
    }

    if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_THREADS: " +
          loadedConfigObj.TNN_EVOLVE_THREADS
      );
      newConfiguration.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
    }

    if (loadedConfigObj.TNN_EVOLVE_ITERATIONS !== undefined) {
      logger.info(
        PF +
          " | LOADED TNN_EVOLVE_ITERATIONS: " +
          loadedConfigObj.TNN_EVOLVE_ITERATIONS
      );
      if (empty(newConfiguration.evolve)) {
        newConfiguration.evolve = {};
      }
      newConfiguration.evolve.iterations =
        loadedConfigObj.TNN_EVOLVE_ITERATIONS;
    }

    return newConfiguration;
  } catch (err) {
    logger.error(
      PF + " | ERROR LOAD DROPBOX CONFIG: " + fullPath + "\n" + jsonPrint(err)
    );
    throw err;
  }
}

async function loadAllConfigFiles() {
  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({
    folder: configDefaultFolder,
    file: configDefaultFile,
  });

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    logger.info(
      PF +
        " | +++ RELOADED DEFAULT CONFIG " +
        configDefaultFolder +
        "/" +
        configDefaultFile
    );
  }

  const hostConfig = await loadConfigFile({
    folder: configHostFolder,
    file: configHostFile,
  });

  if (hostConfig) {
    hostConfiguration = hostConfig;
    logger.info(
      PF +
        " | +++ RELOADED HOST CONFIG " +
        configHostFolder +
        "/" +
        configHostFile
    );
  }

  const overwriteMerge = (destinationArray, sourceArray) => sourceArray;
  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration, {
    arrayMerge: overwriteMerge,
  }); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig, {
    arrayMerge: overwriteMerge,
  }); // any new settings override existing config

  configuration = tempConfig;

  return;
}

//=========================================================================
// FILE SAVE
//=========================================================================
let saveFileQueueInterval;
const saveFileQueue = [];
let statsUpdateInterval;

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;

statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;

function initSaveFileQueue(cnf) {
  logger.info(
    PF +
      " | INIT DROPBOX SAVE FILE INTERVAL | " +
      msToTime(cnf.saveFileQueueInterval)
  );

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(async function () {
    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {
      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();
      saveFileObj.verbose = true;

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try {
        await tcUtils.saveFile(saveFileObj);
        logger.info(
          PF +
            " | SAVED FILE" +
            " [Q: " +
            saveFileQueue.length +
            "] " +
            saveFileObj.folder +
            "/" +
            saveFileObj.file
        );
        statsObj.queues.saveFileQueue.busy = false;
      } catch (err) {
        logger.info(
          PF +
            " | *** SAVE FILE ERROR ... RETRY" +
            " | ERROR: " +
            err +
            " | " +
            saveFileObj.folder +
            "/" +
            saveFileObj.file
        );
        saveFileQueue.push(saveFileObj);
        statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        statsObj.queues.saveFileQueue.busy = false;
      }
    }
  }, cnf.saveFileQueueInterval);
}

//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals() {
  return new Promise(function (resolve, reject) {
    try {
      [...intervalsSet].forEach(function (intervalHandle) {
        logger.info(PF + " | CLEAR INTERVAL | " + intervalHandle);
        clearInterval(intervalHandle);
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

let quitFlag = false;

function readyToQuit() {
  const flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {
  if (quitFlag) {
    logger.info(PF + " | ALREADY IN QUIT");
    if (opts) {
      logger.info(opts);
    }
    return;
  }

  quitFlag = true;

  const options = opts || false;

  let slackText = hostname.toUpperCase() + " | QUIT";
  if (options) {
    slackText += " | " + options.cause;
  }

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  try {
    dogstatsd.event(`${DDPF} | QUIT`, `opts: ${opts}`);
    slackSendQueue.push({ channel: slackChannel, text: slackText });
    fsm.fsm_quit();
    await childQuitAll();
    await killAll();
    await showStats(true);
  } catch (err) {
    logger.info(PF + " | *** QUIT ERROR: " + err);
  }

  if (options) {
    logger.info(PF + " | QUIT INFO\n" + jsonPrint(options));
  }

  setInterval(async function () {
    if (readyToQuit()) {
      await clearAllIntervals();

      if (forceQuitFlag) {
        logger.info(
          PF +
            " | *** FORCE QUIT" +
            " | SAVE FILE BUSY: " +
            statsObj.queues.saveFileQueue.busy +
            " | SAVE FILE Q: " +
            statsObj.queues.saveFileQueue.size
        );
      } else {
        logger.info(
          PF +
            " | ALL PROCESSES COMPLETE ... QUITTING" +
            " | SAVE FILE BUSY: " +
            statsObj.queues.saveFileQueue.busy +
            " | SAVE FILE Q: " +
            statsObj.queues.saveFileQueue.size
        );
      }

      const command = "pkill " + configuration.childIdPrefix + "*";

      shell.exec(command, function (code, stdout, stderr) {
        logger.info(
          PF +
            " | KILL ALL CHILD" +
            "\nCOMMAND: " +
            command +
            "\nCODE:    " +
            code +
            "\nSTDOUT:  " +
            stdout +
            "\nSTDERR:  " +
            stderr
        );

        shell.cd(childPidFolderLocal);
        shell.rm(configuration.childIdPrefix + "*");
      });

      if (!mongooseDb) {
        process.exit();
      } else {
        setTimeout(function () {
          mongooseDb.close(async function () {
            logger.info(
              PF +
                " | ==========================\n" +
                PF +
                " | MONGO DB CONNECTION CLOSED\n" +
                PF +
                " | ==========================\n"
            );

            process.exit();
          });
        }, 1000);
      }
    }
  }, QUIT_WAIT_INTERVAL);
}

//=========================================================================
// STDIN
//=========================================================================
let stdin;
let abortCursor = false;

import cla from "command-line-args";

const help = { name: "help", alias: "h", type: Boolean };

const enableStdin = {
  name: "enableStdin",
  alias: "S",
  type: Boolean,
  defaultValue: true,
};
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = {
  name: "quitOnError",
  alias: "Q",
  type: Boolean,
  defaultValue: true,
};
const verbose = { name: "verbose", alias: "v", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean };
const binaryMode = { name: "binaryMode", alias: "b", type: Boolean };
const scaleLogMode = { name: "scaleLogMode", alias: "l", type: Boolean };

const forceNetworkTechnology = {
  name: "forceNetworkTechnology",
  alias: "c",
  type: String,
};
const threads = { name: "threads", alias: "t", type: Number };
const maxNumberChildren = {
  name: "maxNumberChildren",
  alias: "N",
  type: Number,
};
const useLocalTrainingSets = {
  name: "useLocalTrainingSets",
  alias: "L",
  type: Boolean,
};
const loadAllInputs = { name: "loadAllInputs", type: Boolean };
const inputsId = { name: "inputsId", alias: "i", type: String };
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String };
const networkCreateMode = {
  name: "networkCreateMode",
  alias: "n",
  type: String,
  defaultValue: "evolve",
};
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number };
const seedNetworkProbability = {
  name: "seedNetworkProbability",
  alias: "p",
  type: Number,
};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "B", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number };

const optionDefinitions = [
  forceNetworkTechnology,
  threads,
  maxNumberChildren,
  useLocalTrainingSets,
  loadAllInputs,
  inputsId,
  trainingSetFile,
  networkCreateMode,
  hiddenLayerSize,
  seedNetworkProbability,
  seedNetworkId,
  useBestNetwork,
  enableStdin,
  quitOnComplete,
  quitOnError,
  verbose,
  evolveIterations,
  testMode,
  binaryMode,
  scaleLogMode,
  help,
];

const commandLineConfig = cla(optionDefinitions);

logger.info(commandLineConfig);

if (commandLineConfig.targetServer === "LOCAL") {
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE") {
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

if (Object.keys(commandLineConfig).includes("help")) {
  logger.info(PF + " |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit({ cause: "help" });
}

statsObj.commandLineConfig = commandLineConfig;

function loadCommandLineArgs() {
  return new Promise(function (resolve) {
    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.eachSeries(
      commandLineConfigKeys,
      function (arg, cb) {
        if (arg === "threads") {
          configuration.evolve.threads = commandLineConfig[arg];
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration.evolve.iterations
          );
        } else if (arg === "evolveIterations") {
          configuration.evolve.iterations = commandLineConfig[arg];
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration.evolve.iterations
          );
        } else if (arg === "forceNetworkTechnology") {
          configuration.networkTechnology = commandLineConfig[arg];
          configuration.forceNetworkTechnology = commandLineConfig[arg];
          configuration.enableRandomTechnology = false;
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration.networkTechnology
          );
        } else if (arg === "binaryMode") {
          configuration[arg] = commandLineConfig[arg];
          configuration.enableRandomBinaryMode = false;
          configuration.scaleLogMode = !commandLineConfig[arg];
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration[arg]
          );
        } else if (arg === "scaleLogMode") {
          // configuration[arg] = commandLineConfig[arg];
          configuration.enableRandomBinaryMode = false;
          configuration.binaryMode = !commandLineConfig[arg];
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              " | binaryMode: " +
              configuration.binaryMode
          );
        } else {
          configuration[arg] = commandLineConfig[arg];
          logger.info(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration[arg]
          );
        }

        cb();
      },
      function () {
        statsObj.commandLineArgsLoaded = true;
        resolve();
      }
    );
  });
}

async function loadNetworkInputsConfig(params) {
  try {
    statsObj.status = "LOAD NETWORK INPUTS CONFIG";

    logger.info(
      PF +
        " | LOAD NETWORK INPUTS CONFIG FILE: " +
        configDefaultFolder +
        "/" +
        params.file
    );

    const networkInputsObj = await tcUtils.loadFile({
      folder: configDefaultFolder,
      file: params.file,
    });

    configuration.inputsIdArray = _.union(
      configuration.inputsIdArray,
      networkInputsObj.INPUTS_IDS
    );

    logger.info(
      PF +
        " | LOADED NETWORK INPUTS ARRAY" +
        " | " +
        networkInputsObj.INPUTS_IDS.length +
        " ITEMS IN FILE" +
        " | " +
        configuration.inputsIdArray.length +
        " TOTAL ITEMS IN ARRAY"
    );

    statsObj.networkInputsSetReady = true;
    return;
  } catch (err) {
    logger.error(PF + " | *** NETWORK INPUTS CONFIG FILE LOAD ERROR: " + err);
    statsObj.networkInputsSetReady = false;
    throw err;
  }
}

function initChildPingAllInterval(params) {
  const interval = params
    ? params.interval
    : configuration.childPingAllInterval;

  return new Promise(function (resolve) {
    statsObj.status = "INIT CHILD PING ALL INTERVAL";

    clearInterval(childPingAllInterval);

    childPingAllInterval = setInterval(async function () {
      try {
        await childPingAll();
      } catch (err) {
        logger.error(PF + " | *** CHILD PING ALL ERROR: " + err);
      }
    }, interval);

    intervalsSet.add("childPingAllInterval");

    resolve();
  });
}

//=========================================================================
// FSM
//=========================================================================
import Stately from "stately.js";
const FSM_TICK_INTERVAL = ONE_SECOND;

let fsmTickInterval;
let fsmPreviousState = "RESET";
let createChildrenInProgress = false;
let killAllInProgress = false;

statsObj.fsmState = "RESET";

function reporter(event, oldState, newState) {
  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  dogstatsd.event(`${DDPF} | FSM | ${event}`, `${oldState} -> ${newState}`);

  logger.info(
    PF +
      " | --------------------------------------------------------\n" +
      PF +
      " | << FSM >> MAIN" +
      " | " +
      event +
      " | " +
      fsmPreviousState +
      " -> " +
      newState +
      "\nTNN | --------------------------------------------------------"
  );
}

const fsmStates = {
  RESET: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        logger.info(PF + " | FSM RESET");

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try {
          await childQuitAll();
          await killAll();
          await showStats(true);
        } catch (err) {
          logger.info(PF + " | *** QUIT ERROR: " + err);
        }
      }
    },

    fsm_tick: function () {
      if (getChildProcesses() > 0) {
        if (!killAllInProgress) {
          killAllInProgress = true;

          killAll()
            .then(function () {
              killAllInProgress = false;
            })
            .catch(function (err) {
              killAllInProgress = false;
              logger.error(PF + " | KILL ALL CHILD ERROR: " + err);
            });
        }
      } else {
        checkChildState({ checkState: "RESET", noChildrenTrue: true })
          .then(function (allChildrenReset) {
            logger.info(PF + " | ALL CHILDREN RESET: " + allChildrenReset);
            if (!killAllInProgress && allChildrenReset) {
              fsm.fsm_resetEnd();
            }
          })
          .catch(function (err) {
            logger.error(PF + " | *** ALL CHILDREN RESET ERROR: " + err);
            fsm.fsm_error();
          });
      }
    },

    fsm_resetEnd: "IDLE",
  },

  IDLE: {
    onEnter: function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM IDLE";

        checkChildState({ checkState: "IDLE", noChildrenTrue: true })
          .then(function (allChildrenIdle) {
            logger.info(PF + " | ALL CHILDREN IDLE: " + allChildrenIdle);
          })
          .catch(function (err) {
            logger.error(PF + " | *** ALL CHILDREN IDLE ERROR: " + err);
            fsm.fsm_error();
          });
      }
    },

    fsm_tick: function () {
      checkChildState({ checkState: "IDLE", noChildrenTrue: true })
        .then(function (allChildrenIdle) {
          debug("INIT TICK | ALL CHILDREN IDLE: " + allChildrenIdle);
          if (allChildrenIdle) {
            fsm.fsm_init();
          }
        })
        .catch(function (err) {
          logger.error(PF + " | *** ALL CHILDREN IDLE ERROR: " + err);
          fsm.fsm_error();
        });
    },

    fsm_init: "INIT",
    fsm_quit: "QUIT",
    fsm_error: "ERROR",
  },

  QUIT: {
    onEnter: function (event, oldState, newState) {
      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM QUIT";

      quit({ cause: "FSM QUIT" });
    },
  },

  EXIT: {
    onEnter: function (event, oldState, newState) {
      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM EXIT";

      quit({ cause: "FSM EXIT" });
    },
  },

  ERROR: {
    onEnter: function (event, oldState, newState) {
      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM ERROR";

      quit({ cause: "FSM ERROR" });
    },
  },

  INIT: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        try {
          await childCreateAll();

          logger.info(
            PF + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length
          );
        } catch (err) {
          logger.error(PF + " | *** CREATE ALL CHILDREN ERROR: " + err);
          fsm.fsm_error();
        }
      }
    },
    fsm_tick: function () {
      checkChildState({ checkState: "READY", noChildrenTrue: false })
        .then(function (allChildrenReady) {
          debug("READY INIT" + " | ALL CHILDREN READY: " + allChildrenReady);

          if (maxChildren() && allChildrenReady) {
            fsm.fsm_ready();
          }
        })
        .catch(function (err) {
          logger.error(PF + " | *** ALL CHILDREN READY ERROR: " + err);
          fsm.fsm_error();
        });
    },
    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_ready: "READY",
    fsm_reset: "RESET",
  },

  READY: {
    onEnter: function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM READY";

        checkChildState({ checkState: "READY", noChildrenTrue: false })
          .then(function (allChildrenReady) {
            logger.info(PF + " | ALL CHILDREN READY: " + allChildrenReady);
          })
          .catch(function (err) {
            logger.error(PF + " | *** ALL CHILDREN READY ERROR: " + err);
            fsm.fsm_error();
          });
      }
    },
    fsm_tick: function () {
      checkChildState({ checkState: "READY", noChildrenTrue: false })
        .then(function (allChildrenReady) {
          debug("READY TICK" + " | ALL CHILDREN READY: " + allChildrenReady);

          if (maxChildren() && allChildrenReady) {
            fsm.fsm_run();
          }
        })
        .catch(function (err) {
          logger.error(PF + " | *** ALL CHILDREN READY ERROR: " + err);
          fsm.fsm_error();
        });
    },
    fsm_run: "RUN",
    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
  },

  RUN: {
    onEnter: async function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM RUN";

        try {
          await initChildPingAllInterval();
          await childStatsAll();

          await loadNetworkInputsConfig({ file: defaultBestInputsConfigFile });
          await loadNetworkInputsConfig({
            file: defaultNetworkInputsConfigFile,
          });
          await loadNetworkInputsConfig({ file: defaultUnionInputsConfigFile });
          await loadInputsFolders({ folders: [defaultInputsFolder] });
          await loadBestNetworkFolders({
            folders: [
              globalBestNetworkFolder,
              localBestNetworkFolder,
              hostBestNetworkFolder,
            ],
            purgeMin: configuration.hostPurgeMinSuccessRate,
          });

          await childStartAll();
        } catch (err) {
          logger.error(PF + " | *** RUN ERROR: " + err);
        }
      }
    },
    fsm_tick: function () {
      if (configuration.quitOnComplete) {
        checkChildState({ checkState: "COMPLETE" })
          .then(function (allChildrenComplete) {
            debug(
              "FETCH_END TICK" +
                " | ALL CHILDREN COMPLETE: " +
                allChildrenComplete
            );

            if (allChildrenComplete) {
              logger.info(PF + " | ALL CHILDREN COMPLETE");
              // sentAllChildrenCompleteFlag = false;
              fsm.fsm_complete();
            }
          })
          .catch(function (err) {
            logger.info(PF + " | *** ALL CHILDREN COMPLETE ERROR: " + err);
            fsm.fsm_error();
          });
      } else if (!maxChildren()) {
        logger.info(
          PF +
            " | LESS THAN MAX CHILDREN: " +
            getNumberOfChildren() +
            " | MAX: " +
            configuration.maxNumberChildren
        );

        if (!createChildrenInProgress) {
          createChildrenInProgress = true;

          childCreateAll()
            .then(function (childIdArray) {
              logger.info(
                PF + " | CREATED ALL CHILDREN: " + childIdArray.length
              );
              childIdArray.forEach(async function (childId) {
                await startNetworkCreate({
                  childId: childId,
                  binaryMode: configuration.binaryMode,
                  // logScaleMode: configuration.logScaleMode,
                  compareTech: configuration.compareTech,
                });
              });
              createChildrenInProgress = false;
            })
            .catch(function (err) {
              logger.error(PF + " | *** CREATE ALL CHILDREN ERROR: " + err);
              createChildrenInProgress = false;
              fsm.fsm_error();
            });
        }
      }
    },
    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
    fsm_complete: "COMPLETE",
  },

  COMPLETE: {
    onEnter: function (event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM COMPLETE";

        logger.info(PF + " | FSM COMPLETE | QUITTING ...");

        quit({ cause: "FSM_COMPLETE" });
      }
    },

    fsm_tick: function () {
      checkChildState({ checkState: "RESET", noChildrenTrue: true })
        .then(function (allChildrenReset) {
          logger.info(
            PF + " | RESET TICK" + " | ALL CHILDREN RESET: " + allChildrenReset
          );
          if (allChildrenReset) {
            fsm.fsm_resetEnd();
          }
        })
        .catch(function (err) {
          logger.error(PF + " | *** checkChildState ERROR:", err);
          fsm.fsm_error();
        });
    },

    fsm_init: "INIT",
    fsm_resetEnd: "INIT",
    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
  },
};

const fsm = Stately.machine(fsmStates);

async function initFsmTickInterval(interval) {
  logger.info(interval);

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function () {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);

  return;
}

//=========================================================================
// CHILD PROCESS
//=========================================================================
configuration.reinitializeChildOnClose = false;

function maxChildren() {
  return getNumberOfChildren() >= configuration.maxNumberChildren;
}

function getNumberOfChildren() {
  return Object.keys(childHashMap).length;
}

function childCreateAll(p) {
  return new Promise(function (resolve, reject) {
    logger.info(PF + " | CREATING ALL CHILDREN");

    const params = p || {};

    const childrenCreatedArray = [];

    const interval = params.interval || 5 * ONE_SECOND;
    let childIndex = params.childIndex || configuration.childIndex;

    let childId = CHILD_PREFIX + "_" + childIndex;
    let childIdShort = CHILD_PREFIX_SHORT + "_" + childIndex;

    const options = {};
    options.cwd = configuration.cwd;
    options.env = {};
    options.env = configuration.DROPBOX;
    options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
    options.env.CHILD_ID = childId;
    options.env.CHILD_ID_SHORT = childIdShort;
    options.env.NODE_ENV = "production";

    const createParams = {};
    createParams.args = [];
    createParams.options = {};
    createParams.config = {};
    createParams.childId = childId;
    createParams.childIdShort = childIdShort;
    createParams.verbose = params.verbose || configuration.verbose;
    createParams.appPath = params.appPath || configuration.childAppPath;
    createParams.options = params.options || options;
    createParams.config = params.config || {};

    async.whilst(
      function test(cbTest) {
        cbTest(null, !maxChildren());
      },

      function (cb) {
        setTimeout(function () {
          childId =
            CHILD_PREFIX +
            "_" +
            hostname +
            "_" +
            process.pid +
            "_" +
            childIndex;
          childIdShort = CHILD_PREFIX_SHORT + childIndex;

          createParams.childId = childId;
          createParams.childIdShort = childIdShort;
          options.env.CHILD_ID = childId;
          options.env.CHILD_ID_SHORT = childIdShort;

          if (configuration.verbose) {
            logger.info("createParams\n" + jsonPrint(createParams));
          }

          childCreate(createParams)
            .then(function () {
              childrenCreatedArray.push(childId);
              childIndex += 1;
              dogstatsd.gauge("tnn.child.index", childIndex);
              configuration.childIndex = childIndex;
              statsObj.childIndex = childIndex;
              cb();
            })
            .catch(function (err) {
              logger.info(PF + " | *** ERROR CHILD CREATE ERROR: " + err);
              return cb(err);
            });
        }, interval);
      },

      function (err) {
        if (err) {
          logger.info(PF + " | *** ERROR CREATE ALL CHILDREN: " + err);
          return reject(err);
        }
        resolve(childrenCreatedArray);
      }
    );
  });
}

async function childStatsAll(p) {
  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "STATS";
  defaultCommand.now = now;

  const command = params.command || defaultCommand;
  await childSendAll({ command: command });
}

function getNewNetworkId(p) {
  const params = p || {};
  params.prefix = params.prefix || configuration.networkIdPrefix;
  const networkId = params.prefix + "_" + networkIndex;
  networkIndex += 1;
  dogstatsd.gauge("tnn.network.index", networkIndex);
  return networkId;
}

async function startNetworkCreate(params) {
  const binaryMode =
    params.binaryMode !== undefined
      ? params.binaryMode
      : configuration.binaryMode;
  const compareTech =
    params.compareTech !== undefined
      ? params.compareTech
      : configuration.compareTech;
  const networkId = getNewNetworkId();

  logger.info(
    "\n========================================================================================\n" +
      PF +
      " | " +
      params.childId +
      " | >>> START NETWORK CREATE | " +
      networkId +
      "\n========================================================================================\n"
  );

  childHashMap[params.childId].currentNetworkId = networkId;
  childHashMap[params.childId].binaryMode = binaryMode;
  childHashMap[params.childId].compareTech = compareTech;

  await initNetworkCreate({
    childId: params.childId,
    networkId: networkId,
    compareTech: compareTech,
  });

  return;
}

function childStartAll(p) {
  return new Promise(function (resolve, reject) {
    const params = p || {};
    const binaryMode =
      params.binaryMode !== undefined
        ? params.binaryMode
        : configuration.binaryMode;
    const compareTech =
      params.compareTech !== undefined
        ? params.compareTech
        : configuration.compareTech;

    logger.info(
      PF +
        " | START EVOLVE ALL CHILDREN: compareTech: " +
        compareTech +
        " | NUM CH: " +
        Object.keys(childHashMap).length
    );

    async.eachSeries(
      Object.keys(childHashMap),
      async function (childId) {
        try {
          if (
            childHashMap[childId] !== undefined &&
            childHashMap[childId].type === "EVOLVE"
          ) {
            await startNetworkCreate({
              childId: childId,
              binaryMode: binaryMode,
              compareTech: compareTech,
            });
            return;
          } else {
            logger.info(PF + " | *** CHILD NOT IN childHashMap: " + childId);
            return;
          }
        } catch (err) {
          return err;
        }
      },
      function (err) {
        if (err) {
          logger.error(PF + " | *** CHILD START ALL ERROR: " + err);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

async function childQuitAll(p) {
  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "QUIT";
  defaultCommand.now = now;

  const command = params.command || defaultCommand;

  await childSendAll({ command: command });
  return;
}

function childSend(p) {
  const params = p || {};

  return new Promise(function (resolve, reject) {
    const childId = params.command.childId;
    const command = params.command;

    statsObj.status = "SEND CHILD | CH ID: " + childId + " | " + command.op;

    if (configuration.verbose || configuration.testMode) {
      logger.info(
        PF + " | >T MESSAGE | " + getTimeStamp() + " | OP: " + command.op
      );
    }

    if (
      empty(childHashMap[childId]) ||
      !childHashMap[childId].child ||
      !childHashMap[childId].child.connected
    ) {
      logger.info(
        PF +
          " | XXX CHILD SEND ABORTED | CHILD NOT CONNECTED OR UNDEFINED | " +
          childId
      );
      return reject(new Error("CHILD NOT CONNECTED OR UNDEFINED: " + childId));
    }

    childHashMap[childId].child.send(command);

    resolve();
  });
}

async function childSendAll(p) {
  const params = p || {};

  let op = "PING";

  if (params.command) {
    op = params.command.op;
  } else if (params.op) {
    op = params.op;
  }

  const now = params.now || true;

  const defaultCommand = {};
  defaultCommand.op = op;
  defaultCommand.now = now;
  defaultCommand.pingId = getTimeStamp();

  const command = params.command || defaultCommand;

  for (const childId of Object.keys(childHashMap)) {
    if (childHashMap[childId] !== undefined) {
      command.childId = childId;
      await childSend({ command: command });
    }
  }

  return;
}

async function childInit(p) {
  let command;

  try {
    const params = p || {};

    logger.info(`${PF} | childInit\n${jsonPrint(params)}`);

    const childId = params.childId;
    const childIdShort = params.childIdShort;
    const testSetRatio = params.testSetRatio || configuration.testSetRatio;
    const verbose = params.verbose !== undefined ? params.verbose : false;
    const testMode = params.testMode !== undefined ? params.testMode : false;
    const config = params.configuration || childConfiguration;

    statsObj.status = "INIT CHILD | CH ID: " + childId;

    command = {
      op: "INIT",
      moduleIdPrefix: childIdShort,
      childId: childId,
      childIdShort: childIdShort,
      testSetRatio: testSetRatio,
      testMode: testMode,
      verbose: verbose,
      configuration: config,
    };

    logger.info(`${PF} | childInit\ncommand\n${jsonPrint(command)}`);

    const response = await childSend({ childId: childId, command: command });
    return response;
  } catch (err) {
    logger.error(
      PF +
        " | *** CHILD SEND INIT ERROR" +
        " | ERR: " +
        err +
        "\nCOMMAND\n" +
        jsonPrint(command)
    );
    throw err;
  }
}

function expo(x, f) {
  return Number.parseFloat(x).toExponential(f);
}

async function evolveErrorHandler(params) {
  try {
    const m = params.m;

    logger.error(
      "\nTNN | ========================================================" +
        "\nTNN | NETWORK EVOLVE ERROR" +
        "\nTNN | ========================================================" +
        "\nTNN | CHILD:      " +
        m.childId +
        "\nTNN | NID:        " +
        m.networkId +
        "\nTNN | ERROR\n" +
        jsonPrint(m.err) +
        "\nTNN | ========================================================\n"
    );

    resultsHashmap[m.networkId] = {};
    resultsHashmap[m.networkId] = omit(m.networkObj, [
      "network",
      "networkJson",
      "networkRaw",
      "inputs",
      "outputs",
      "inputsObj",
    ]);
    resultsHashmap[m.networkId].status = "*** ERROR ***";
    resultsHashmap[m.networkId].error = m.err;
    resultsHashmap[m.networkId].stats = {};
    resultsHashmap[m.networkId].stats = omitDeep(m.statsObj, [
      "inputsObj",
      "train",
      "outputs",
      "normalization",
      "evolve.options.networkObj.network",
      "evolve.options.networkObj.networkJson",
      "evolve.options.networkObj.networkRaw",
      "evolve.options.networkObj.inputsObj",
    ]);

    if (empty(childHashMap[m.childId])) {
      logger.info("??? CHILD NOT IN childHashMap ??? | CHILD ID: " + m.childId);
      childHashMap[m.childId] = {};
      childHashMap[m.childId].status = "IDLE";
    } else {
      if (configuration.quitOnComplete) {
        logger.info(">>> CHILD QUIT ON COMPLETE | CHILD ID: " + m.childId);
        childHashMap[m.childId].status = "COMPLETE";
      } else {
        childHashMap[m.childId].status = "READY";
      }
    }

    statsObj.evolveStats.results[m.networkId] = {};
    statsObj.evolveStats.results[m.networkId] = resultsHashmap[m.networkId];

    await printResultsHashmap();

    let slackText = hostname.toUpperCase() + "\n*EVOLVE ERROR*";
    slackText = slackText + "\n" + jsonPrint(m.err);

    slackSendQueue.push({ channel: slackChannelError, text: slackText });

    return;
  } catch (err) {
    logger.error("EVOLVE_ERROR ERROR: " + err);
    throw err;
  }
}

async function evolveCompleteHandler(params) {
  try {
    const m = params.m;

    const nn = await global.wordAssoDb.NeuralNetwork.findOne({
      networkId: m.networkId,
    })
      .lean()
      .exec();

    // const nn = nnDoc.toObject();

    nn.seedNetworkId =
      nn.seedNetworkId &&
      nn.seedNetworkId !== undefined &&
      nn.seedNetworkId !== "false"
        ? nn.seedNetworkId
        : false;
    // nn.logScaleMode = (nn.logScaleMode && nn.logScaleMode !== undefined && nn.logScaleMode !== "false") ? nn.logScaleMode : false;

    m.statsObj.fitness = statsObj.networkResults[nn.networkId].fitness;
    statsObj.evolveStats.total += 1;
    dogstatsd.increment("tnn.network.evolve.total");

    const snIdRes =
      nn.seedNetworkId && nn.seedNetworkRes && nn.seedNetworkRes !== undefined
        ? parseFloat(nn.seedNetworkRes).toFixed(2)
        : "---";

    logger.info(
      "\nTNN | ========================================================" +
        "\nTNN | NETWORK EVOLVE + TEST COMPLETE | SUCCESS: " +
        nn.test.results.successRate.toFixed(2) +
        "%" +
        "\nTNN | ========================================================" +
        "\nTNN | CHILD:            " +
        m.childId +
        "\nTNN | NID:              " +
        nn.networkId +
        "\nTNN | TECH:             " +
        nn.networkTechnology +
        "\nTNN | BIN MODE:         " +
        nn.binaryMode +
        // + "\nTNN | LOG SCALE MODE:   " + nn.logScaleMode
        "\nTNN | TEST [P/T]:       " +
        nn.test.results.numPassed +
        "/" +
        nn.test.results.numTests +
        "\nTNN | SEED:             " +
        nn.seedNetworkId +
        "\nTNN | SEED SR%:         " +
        snIdRes +
        "\nTNN | ELAPSED:          " +
        msToTime(nn.evolve.elapsed) +
        "\nTNN | ITERTNS:          " +
        m.statsObj.iterations +
        "\nTNN | ERROR:            " +
        m.statsObj.error +
        "\nTNN | FITNESS:          " +
        m.statsObj.fitness +
        "\nTNN | INPUTS ID:        " +
        nn.inputsId +
        "\nTNN | INPUTS:           " +
        nn.numInputs +
        "\nTNN | HIDDEN:           " +
        nn.hiddenLayerSize +
        "\nTNN | OUTPUTS:          " +
        nn.numOutputs +
        // + "\nTNN | DROPOUT:          " + nn.networkJson.dropout
        "\nTNN | ========================================================\n"
    );

    resultsHashmap[nn.networkId] = {};
    resultsHashmap[nn.networkId] = omit(nn, [
      "network",
      "networkJson",
      "networkRaw",
      "inputs",
      "outputs",
      "inputsObj",
    ]);
    resultsHashmap[nn.networkId].status = "COMPLETE";
    resultsHashmap[nn.networkId].stats = {};
    resultsHashmap[nn.networkId].stats = omitDeep(m.statsObj, [
      "inputsObj",
      "train",
      "outputs",
      "normalization",
      "evolve.options.networkObj.network",
      "evolve.options.networkObj.networkJson",
      "evolve.options.networkObj.networkRaw",
      "evolve.options.networkObj.inputsObj",
    ]);

    if (empty(childHashMap[m.childId])) {
      logger.info("??? CHILD NOT IN childHashMap ??? | CHILD ID: " + m.childId);
      childHashMap[m.childId] = {};
      childHashMap[m.childId].status = "IDLE";
    } else {
      if (configuration.quitOnComplete) {
        childHashMap[m.childId].status = "COMPLETE";
      } else {
        childHashMap[m.childId].status = "READY";
      }
    }

    // PASSED
    if (
      nn.test.results.successRate < 100 &&
      ((nn.seedNetworkId &&
        nn.seedNetworkId !== undefined &&
        nn.seedNetworkId !== "false" &&
        nn.test.results.successRate > nn.seedNetworkRes) || // better than seed nn
        (!nn.seedNetworkId &&
          nn.test.results.successRate >= configuration.hostMinSuccessRate) || // no seed but better than local min
        (configuration.testMode &&
          !nn.seedNetworkId &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRate) || // no seed but better than local min
        (!nn.seedNetworkId &&
          nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate >= configuration.hostMinSuccessRateMSE) || // no seed but better than local min
        (configuration.testMode &&
          !nn.seedNetworkId &&
          nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRateMSE) || // no seed but better than local min
        nn.test.results.successRate >= configuration.localMinSuccessRate || // better than local min
        nn.test.results.successRate >= configuration.globalMinSuccessRate) // better than global min
    ) {
      // It's a Keeper!!

      dogstatsd.event(
        `${DDPF} | PASSED`,
        `SR: ${nn.test.results.successRate.toFixed(3)} %` +
          ` | ${nn.evolve.results.iterations} iterations` +
          ` | ELPSD: ${msToTime(nn.evolve.elapsed)}`
      );
      await updateDbInputs({ inputsId: nn.inputsId, networkId: nn.networkId });

      bestNetworkFile = nn.networkId + ".json";

      viableNetworkIdSet.add(nn.networkId);

      if (
        empty(
          inputsIdTechHashMap.networkTechnology[nn.networkTechnology][
            nn.inputsId
          ]
        )
      ) {
        inputsIdTechHashMap.networkTechnology[nn.networkTechnology][
          nn.inputsId
        ] = new Set();
      }

      inputsIdTechHashMap.networkTechnology[nn.networkTechnology][
        nn.inputsId
      ].add(nn.networkId);

      // nn seed but better than parent; add to nn child better than parent array
      if (
        nn.seedNetworkId &&
        nn.test.results.successRate < 100 &&
        nn.seedNetworkRes > 0 &&
        nn.test.results.successRate >= nn.seedNetworkRes
      ) {
        betterChildSeedNetworkIdSet.add(nn.networkId);

        nn.betterChild = true;
        resultsHashmap[nn.networkId].betterChild = true;

        logger.info(
          PF +
            " | +++ BETTER CHILD" +
            " [" +
            betterChildSeedNetworkIdSet.size +
            "] " +
            nn.networkId +
            " | SR: " +
            nn.test.results.successRate.toFixed(3) +
            "%" +
            " | SEED: " +
            nn.seedNetworkId +
            " | SR: " +
            nn.seedNetworkRes +
            "%"
        );
      }
      // no seed but better than hostMinSuccessRate, so act like better child and start parent/child chain
      else if (
        (!nn.seedNetworkId &&
          nn.test.results.successRate < 100 &&
          nn.test.results.successRate >= configuration.hostMinSuccessRate) ||
        (configuration.testMode &&
          !nn.seedNetworkId &&
          nn.test.results.successRate < 100 &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRate) ||
        (!nn.seedNetworkId &&
          nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate < 100 &&
          nn.test.results.successRate >= configuration.hostMinSuccessRateMSE) ||
        (configuration.testMode &&
          !nn.seedNetworkId &&
          nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate < 100 &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRateMSE)
      ) {
        betterChildSeedNetworkIdSet.add(nn.networkId);

        nn.betterChild = false;
        resultsHashmap[nn.networkId].betterChild = false;

        logger.info(
          PF +
            " | +++ ADD LOCAL SUCCESS TO BETTER CHILD SET" +
            " [" +
            betterChildSeedNetworkIdSet.size +
            "] " +
            nn.networkId +
            " | SR: " +
            nn.test.results.successRate.toFixed(3) +
            "%"
        );
      }
      // not better child
      else {
        nn.betterChild = false;
        resultsHashmap[nn.networkId].betterChild = false;
      }

      if (empty(inputsNetworksHashMap[nn.inputsId])) {
        inputsNetworksHashMap[nn.inputsId] = new Set();
      }

      inputsNetworksHashMap[nn.inputsId].add(nn.networkId);

      logger.info(
        PF +
          " | INPUTS ID" +
          " | " +
          nn.inputsId +
          " | INPUTS: " +
          nn.numInputs +
          " | " +
          inputsNetworksHashMap[nn.inputsId].size +
          " NETWORKS"
      );

      // GLOBAL SUCCESS
      if (
        nn.test.results.successRate < 100 &&
        nn.test.results.successRate >= configuration.globalMinSuccessRate
      ) {
        logger.info(
          PF +
            " | ### SAVING NN FILE TO DROPBOX GLOBAL BEST" +
            " | " +
            globalBestNetworkFolder +
            "/" +
            bestNetworkFile
        );

        resultsHashmap[nn.networkId].status = "GLOBAL";

        statsObj.evolveStats.passGlobal += 1;
        dogstatsd.increment("tnn.network.evolve.global");

        inputsFailedSet.delete(nn.inputsId);

        if (inputsViableSet.has(nn.inputsId)) {
          logger.info(
            "TNN | GLOBAL BEST | VIABLE NETWORKS INPUTS" +
              " | " +
              nn.networkId +
              " | INPUTS: " +
              nn.inputsId
          );
          statsObj.evolveStats.viableInputs.push(nn.inputsId);
          inputsViableSet.delete(nn.inputsId);
        }

        slackText =
          hostname.toUpperCase() +
          "\n*GLOBAL BEST | " +
          nn.test.results.successRate.toFixed(2) +
          "%*";
        slackText = slackText + "\n" + nn.networkId;
        slackText = slackText + "\nTECH: " + nn.networkTechnology;
        slackText = slackText + "\nIN: " + nn.inputsId;
        slackText = slackText + "\nINPUTS: " + nn.numInputs;
        slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
        slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

        slackSendQueue.push({
          channel: slackChannelPassGlobal,
          text: slackText,
        });

        printNetworkObj(PF + " | " + nn.networkId, nn);

        saveFileQueue.push({
          folder: globalBestNetworkFolder,
          file: bestNetworkFile,
          obj: nn,
        });
      }
      // LOCAL SUCCESS
      else if (
        nn.test.results.successRate < 100 &&
        nn.test.results.successRate >= configuration.localMinSuccessRate
      ) {
        logger.info(
          PF +
            " | ### SAVING NN FILE TO DROPBOX LOCAL BEST" +
            " | " +
            localBestNetworkFolder +
            "/" +
            bestNetworkFile
        );

        resultsHashmap[nn.networkId].status = "LOCAL";

        statsObj.evolveStats.passLocal += 1;
        dogstatsd.increment("tnn.network.evolve.local");

        inputsFailedSet.delete(nn.inputsId);

        if (inputsViableSet.has(nn.inputsId)) {
          logger.info(
            "TNN | LOCAL BEST | VIABLE NETWORKS INPUTS" +
              " | " +
              nn.networkId +
              " | INPUTS: " +
              nn.inputsId
          );
          statsObj.evolveStats.viableInputs.push(nn.inputsId);
          inputsViableSet.delete(nn.inputsId);
        }

        slackText =
          hostname.toUpperCase() +
          "\n*PASS LOCAL | " +
          nn.test.results.successRate.toFixed(2) +
          "%*";
        slackText = slackText + "\n" + nn.networkId;
        slackText = slackText + "\nTECH: " + nn.networkTechnology;
        slackText = slackText + "\nIN: " + nn.inputsId;
        // slackText = slackText + "\nINPUTS: " + nn.networkJson.input;
        slackText = slackText + "\nINPUTS: " + nn.numInputs;
        slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
        slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

        slackSendQueue.push({
          channel: slackChannelPassLocal,
          text: slackText,
        });

        printNetworkObj(PF + " | " + nn.networkId, nn);

        saveFileQueue.push({
          folder: localBestNetworkFolder,
          file: bestNetworkFile,
          obj: nn,
        });
      }
      // HOST SUCCESS
      else if (
        (nn.test.results.successRate < 100 &&
          nn.test.results.successRate >= configuration.hostMinSuccessRate) ||
        (configuration.testMode &&
          nn.test.results.successRate < 100 &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRate) ||
        (nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate >= configuration.hostMinSuccessRateMSE) ||
        (configuration.testMode &&
          nn.evolve.options.cost === "MSE" &&
          nn.test.results.successRate >=
            0.5 * configuration.hostMinSuccessRateMSE)
      ) {
        hostBestNetworkFile = nn.networkId + ".json";

        logger.info(
          PF +
            " | ... SAVING NN FILE TO DROPBOX HOST BEST" +
            " | " +
            hostBestNetworkFolder +
            "/" +
            hostBestNetworkFile
        );

        resultsHashmap[nn.networkId].status = "HOST";

        inputsFailedSet.delete(nn.inputsId);

        statsObj.evolveStats.passLocal += 1;
        dogstatsd.increment("tnn.network.evolve.local");

        if (inputsViableSet.has(nn.inputsId)) {
          logger.info(
            "TNN | HOST BEST | VIABLE NETWORKS INPUTS" +
              " | " +
              nn.networkId +
              " | INPUTS: " +
              nn.inputsId
          );
          statsObj.evolveStats.viableInputs.push(nn.inputsId);
          inputsViableSet.delete(nn.inputsId);
        }

        slackText =
          hostname.toUpperCase() +
          "\n*PASS HOST | " +
          nn.test.results.successRate.toFixed(2) +
          "%*";
        slackText = slackText + "\n" + nn.networkId;
        slackText = slackText + "\nTECH: " + nn.networkTechnology;
        slackText = slackText + "\nIN: " + nn.inputsId;
        slackText = slackText + "\nINPUTS: " + nn.numInputs;
        slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
        slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

        slackSendQueue.push({ channel: slackChannelPassHost, text: slackText });

        saveFileQueue.push({
          folder: hostBestNetworkFolder,
          file: hostBestNetworkFile,
          obj: nn,
        });
      }
    }
    // FAILED
    else {
      dogstatsd.event(
        `${DDPF} | FAILED`,
        `SR: ${nn.test.results.successRate.toFixed(3)} %` +
          ` | ${nn.evolve.results.iterations} iterations` +
          ` | ELPSD: ${msToTime(nn.evolve.elapsed)}`
      );

      logger.info(
        PF +
          " | XXX | NOT SAVING NN GLOBAL or LOCAL DROPBOX ... LESS THAN GLOBAL and LOCAL MIN SUCCESS *OR* NOT BETTER THAN SEED" +
          " | " +
          nn.networkId +
          " | SUCCESS: " +
          nn.successRate.toFixed(2) +
          "%" +
          " | GLOBAL SUCCESS: " +
          configuration.globalMinSuccessRate.toFixed(2) +
          "%" +
          " | LOCAL SUCCESS: " +
          configuration.localMinSuccessRate.toFixed(2) +
          "%"
      );

      if (configuration.removeSeedFromViableNetworkOnFail && nn.seedNetworkId) {
        viableNetworkIdSet.delete(nn.seedNetworkId);
        logger.info(
          PF +
            " | XXX REMOVED SEED NN FROM VIABLE NN SET [" +
            viableNetworkIdSet.size +
            "] | " +
            nn.seedNetworkId
        );
      }

      resultsHashmap[nn.networkId].status = "- fail -";

      if (
        !configuration.testMode &&
        ((nn.evolve.options.cost !== "MSE" &&
          nn.test.results.successRate < configuration.hostMinSuccessRate) ||
          (nn.evolve.options.cost === "MSE" &&
            nn.test.results.successRate < configuration.hostMinSuccessRateMSE))
      ) {
        await updateDbInputs({
          inputsId: nn.inputsId,
          failNetworkId: nn.networkId,
        });
        inputsFailedSet.add(nn.inputsId);
        logger.info(
          PF +
            " | +++ FAILED INPUTS ID TO SET" +
            " [" +
            inputsFailedSet.size +
            "]" +
            " | " +
            nn.inputsId
        );
      }

      // ZERO FAIL SET
      if (
        !configuration.testMode &&
        nn.test.results.successRate < configuration.zeroMinSuccess
      ) {
        const cost = nn.evolve.options.cost;
        const selection = nn.evolve.options.selection;
        const binaryMode = nn.binaryMode ? nn.binaryMode : false;

        const evolveOptionsCombination =
          nn.evolve.options.activation +
          ":" +
          cost +
          ":" +
          selection +
          ":" +
          binaryMode;

        zeroSuccessEvolveOptionsSet.add(evolveOptionsCombination.toUpperCase());

        logger.info(
          PF +
            " | XXX ZERO SUCCESS RATE - ADDED EVOLVE OPTIONS TO ZERO FAIL SET" +
            " [" +
            zeroSuccessEvolveOptionsSet.size +
            "]" +
            " | ACTIVATION: " +
            nn.evolve.options.activation +
            " | COST: " +
            cost +
            " | SELECTION: " +
            selection +
            " | BINARY MODE: " +
            binaryMode
        );

        for (const evolveOptionsCombination of [
          ...zeroSuccessEvolveOptionsSet,
        ].sort()) {
          logger.info(
            PF +
              " | XXX ZERO SUCCESS ACT/COST/SEL" +
              " | " +
              evolveOptionsCombination
          );
        }

        await initZeroSuccessEvolveOptionsSet();

        const zeroSuccessOptionsObj = {};
        zeroSuccessOptionsObj.evolveOptionsCombination = [
          ...zeroSuccessEvolveOptionsSet,
        ];
        statsObj.evolveStats.zeroSuccessOptions =
          zeroSuccessOptionsObj.evolveOptionsCombination;

        let file = defaultZeroSuccessEvolveOptionsFile;

        if (configuration.testMode) {
          file = defaultZeroSuccessEvolveOptionsFile.replace(
            ".json",
            "_test.json"
          );
        }

        tcUtils.saveFile({
          folder: configDefaultFolder,
          file: file,
          obj: zeroSuccessOptionsObj,
        });
      }

      slackText =
        hostname.toUpperCase() +
        "\n*FAIL | " +
        nn.test.results.successRate.toFixed(2) +
        "%*";
      slackText = slackText + "\n" + nn.networkId;
      slackText = slackText + "\nTECH: " + nn.networkTechnology;
      slackText = slackText + "\nIN: " + nn.inputsId;
      slackText = slackText + "\nINPUTS: " + nn.numInputs;
      slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
      slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

      slackSendQueue.push({ channel: slackChannelFail, text: slackText });

      statsObj.evolveStats.fail += 1;
      dogstatsd.increment("tnn.network.evolve.fail");

      if (!configuration.testMode) {
        hostBestNetworkFile = nn.networkId + ".json";

        logger.info(
          PF +
            " | ... SAVING NN FILE TO DROPBOX LOCAL FAIL" +
            " | " +
            localFailNetworkFolder +
            "/" +
            hostBestNetworkFile
        );

        saveFileQueue.push({
          folder: localFailNetworkFolder,
          file: hostBestNetworkFile,
          obj: nn,
        });
      }
    }

    statsObj.evolveStats.results[nn.networkId] = {};
    statsObj.evolveStats.results[nn.networkId] = resultsHashmap[nn.networkId];

    printNetworkObj(PF + " | " + nn.networkId, nn);
    await printResultsHashmap();

    return;
  } catch (err) {
    dogstatsd.event(`${DDPF} | EVOLVE_COMPLETE ERROR`, `ERROR: ${err}`);
    logger.error(PF + "| *** EVOLVE_COMPLETE ERROR: " + err);
    throw err;
  }
}

const clearEvolveTimeout = (childId) => {
  logger.info(
    `${PF} | CLEAR EVOLVE TIMEOUT | CHILD: ${childId} | TIMEOUTS: ${statsObj.errors.evolve.timeouts}`
  );
  clearTimeout(childHashMap[childId].evolveTimeout);
};

let inEvolveTimeout = false;

const resetEvolveTimeout = (childId) => {
  if (inEvolveTimeout) {
    return;
  }

  clearTimeout(childHashMap[childId].evolveTimeout);

  childHashMap[childId].evolveTimeout = setTimeout(async () => {
    inEvolveTimeout = true;

    statsObj.errors.evolve.timeouts += 1;
    dogstatsd.increment("tnn.network.evolve.timouts");
    logger.info(
      `${PF} | !!! EVOLVE TIMEOUT | DUR: ${configuration.evolveTimeoutDuration} | CHILD: ${childId} | TIMEOUTS: ${statsObj.errors.evolve.timeouts}`
    );

    await childSend({ command: { childId: childId, op: "ABORT" } });

    await delay({ period: 15 * ONE_SECOND });

    inEvolveTimeout = false;
  }, configuration.evolveTimeoutDuration);
};

async function childMessageHandler(params) {
  try {
    const childId = params.childId;
    const m = params.message;
    const binaryMode = params.binaryMode;
    const compareTech = params.compareTech;

    let error = 0;
    let fitness = 0;

    if (configuration.verbose) {
      logger.info(PF + " | <R MSG | CHILD " + childId + " | " + m.op);
    }

    switch (m.op) {
      case "ERROR":
        try {
          logger.error(PF + " | " + childId + " | *** ERROR ***");
          console.error(m.err);
          await evolveErrorHandler({ m: m, childId: childId });
          if (!configuration.quitOnComplete) {
            await startNetworkCreate({
              childId: childId,
              binaryMode: binaryMode,
              // logScaleMode: logScaleMode,
              compareTech: compareTech,
            });
          }
        } catch (e) {
          logger.error(
            PF + " | " + childId + " | *** EVOLVE_ERROR ERROR: " + e
          );
        }
        return;

      case "STATS":
        childHashMap[childId].status = m.fsmStatus;
        objectPath.set(
          statsObj,
          ["children", childId, "status"],
          childHashMap[childId].status
        );
        return;

      case "EVOLVE_SCHEDULE":
        await resetEvolveTimeout(childId);

        _.set(
          resultsHashmap[m.stats.networkId],
          "evolve.results.iterations",
          m.stats.iteration
        );

        error = m.stats.error ? Number.parseFloat(m.stats.error) : 9999999;
        fitness = m.stats.fitness
          ? Number.parseFloat(m.stats.fitness)
          : 9999999;

        error = error > 1000 ? expo(error, 2) : error.toFixed(6);
        fitness =
          fitness < -1000 ? expo(m.stats.fitness, 2) : fitness.toFixed(6);

        _.set(resultsHashmap[m.stats.networkId], "evolve.results.error", error);
        _.set(
          resultsHashmap[m.stats.networkId],
          "evolve.results.fitness",
          fitness
        );

        logger.info(
          PF +
            " | " +
            m.childIdShort +
            " | " +
            m.stats.networkTechnology.slice(0, 1).toUpperCase() +
            " | " +
            m.stats.networkId +
            " | " +
            m.stats.inputsId +
            " | ERR " +
            error +
            " | FIT " +
            fitness +
            " | R " +
            msToTime(m.stats.evolveElapsed) +
            " | ETC " +
            msToTime(m.stats.timeToComplete) +
            " " +
            moment().add(m.stats.timeToComplete).format(compactDateTimeFormat) +
            " | " +
            (m.stats.iterationRate / 1000.0).toFixed(3) +
            " spi" +
            " | I " +
            m.stats.iteration +
            "/" +
            m.stats.totalIterations
        );

        if (empty(statsObj.networkResults[m.stats.networkId])) {
          statsObj.networkResults[m.stats.networkId] = {};
          statsObj.networkResults[m.stats.networkId].networkObj = {};
          statsObj.networkResults[m.stats.networkId].networkObj.evolve = {};
          statsObj.networkResults[m.stats.networkId].networkObj.evolve.options =
            {};
        }

        statsObj.networkResults[m.stats.networkId].startTime = getTimeStamp(
          m.stats.evolveStart
        );
        statsObj.networkResults[m.stats.networkId].elapsed = msToTime(
          m.stats.evolveElapsed
        );
        statsObj.networkResults[m.stats.networkId].iteration =
          m.stats.iteration;
        statsObj.networkResults[m.stats.networkId].totalIterations =
          m.stats.totalIterations;
        statsObj.networkResults[m.stats.networkId].rate = (
          m.stats.iterationRate / 1000.0
        ).toFixed(1);
        statsObj.networkResults[m.stats.networkId].timeToComplete = moment()
          .add(m.stats.timeToComplete)
          .format(compactDateTimeFormat);
        statsObj.networkResults[m.stats.networkId].error = m.stats.error;
        statsObj.networkResults[m.stats.networkId].fitness = m.stats.fitness;
        return;

      case "EVOLVE_COMPLETE":
        try {
          clearEvolveTimeout(childId);

          await evolveCompleteHandler({ m: m, childId: childId });
          if (!configuration.quitOnComplete) {
            await startNetworkCreate({
              childId: childId,
              binaryMode: binaryMode,
              // logScaleMode: logScaleMode,
              compareTech: compareTech,
            });
          }
        } catch (e) {
          logger.error(
            PF + " | " + childId + " | *** EVOLVE_COMPLETE ERROR: " + e
          );
        }
        return;

      case "EVOLVE_ERROR":
        try {
          clearEvolveTimeout(childId);

          logger.info(PF + " | " + childId + " | *** EVOLVE_ERROR ***");
          console.error(m.err);
          await evolveErrorHandler({ m: m, childId: childId });
          if (!configuration.quitOnComplete) {
            await startNetworkCreate({
              childId: childId,
              binaryMode: binaryMode,
              compareTech: compareTech,
            });
          }
        } catch (e) {
          logger.error(
            PF + " | " + childId + " | *** EVOLVE_ERROR ERROR: " + e
          );
        }
        return;

      case "EXIT":
      case "QUIT":
      case "INIT":
      case "INIT_COMPLETE":
      case "PONG":
      case "READY":
      case "RESET":
        if (m.op !== "PONG") {
          clearEvolveTimeout(childId);
        }
        childHashMap[childId].status = m.fsmStatus;
        objectPath.set(
          statsObj,
          ["children", childId, "status"],
          childHashMap[childId].status
        );
        return;

      default:
        logger.info(
          PF +
            " | CHILD " +
            childId +
            " | *** ERROR childMessageHandler UNKNOWN OP: " +
            m.op
        );
        throw new Error("UNKNOWN CHILD MESSAGE OP: " + m.op);
    }
  } catch (err) {
    logger.error(PF + " | *** childMessageHandler ERROR: " + err);
    throw err;
  }
}

async function childCreate(p) {
  let config;
  const options = {};

  try {
    statsObj.status = "CHILD CREATE";

    const params = p || {};

    const binaryMode =
      params.binaryMode !== undefined
        ? params.binaryMode
        : configuration.binaryMode;
    const compareTech =
      params.compareTech !== undefined
        ? params.compareTech
        : configuration.compareTech;

    const childId = params.childId;
    const childIdShort = params.childIdShort;
    const appPath = params.appPath;
    const env = params.env;
    config = params.config || {};

    let child = {};

    options.cwd = params.cwd || configuration.cwd;

    statsObj.status = "CHILD CREATE | CH ID: " + childId + " | APP: " + appPath;

    logger.info(PF + " | CREATE CHILD | " + childId);

    if (env) {
      options.env = env;
    } else {
      options.env = {};
      options.env = configuration.DROPBOX;
      options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
      options.env.CHILD_ID = childId;
      options.env.NODE_ENV = "production";
    }

    childHashMap[childId] = {};
    childHashMap[childId].childId = childId;
    childHashMap[childId].childIdShort = childIdShort;
    childHashMap[childId].type = "EVOLVE";
    childHashMap[childId].status = "NEW";
    childHashMap[childId].currentNetworkId = false;
    childHashMap[childId].messageQueue = [];
    childHashMap[childId].evolveTimeout = null;

    child = cp.fork(`${__dirname}/neuralNetworkChild.js`);

    logger.info(`${PF} | +++ CREATED CHILD | PID: ${child.pid}`);

    childHashMap[childId].pid = child.pid;

    const childPidFile = await touchChildPidFile({
      childId: childId,
      pid: child.pid,
    });

    childHashMap[childId].childPidFile = childPidFile;
    childHashMap[childId].child = child;

    childHashMap[childId].child.on("disconnect", function () {
      logger.warn(PF + " | *** CHILD DISCONNECT | " + childId);
      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);
      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("close", function () {
      logger.warn(PF + " | *** CHILD CLOSED | " + childId);
      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);
      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("exit", function () {
      logger.warn(PF + " | *** CHILD EXITED | " + childId);
      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);
      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("error", function (err) {
      logger.error(PF + " | *** CHILD ERROR: " + err);
      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);
      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("message", async function (message) {
      await childMessageHandler({
        childId: childId,
        message: message,
        binaryMode: binaryMode,
        compareTech: compareTech,
      });

      if (configuration.verbose) {
        logger.info(
          PF + " | <R MESSAGE | " + getTimeStamp() + " | OP: " + message.op
        );
      }
    });

    if (quitFlag) {
      logger.warn(
        PF +
          " | KILL CHILD IN CREATE ON QUIT FLAG" +
          " | " +
          getTimeStamp() +
          " | " +
          childId
      );
      childHashMap[childId].child.kill();
    }

    const childInitParams = {};
    childInitParams.childId = childId;
    childInitParams.childIdShort = childHashMap[childId].childIdShort;
    childInitParams.configuration = childConfiguration;
    childInitParams.trainingSetsFolder = configuration.trainingSetsFolder;
    childInitParams.userDataFolder = configuration.userDataFolder;
    childInitParams.testMode = configuration.testMode;
    childInitParams.verbose = configuration.verbose;

    // KLUDGE!! need to insure child is ready before sending INIT command

    logger.info(
      `${PF} | WAIT CHILD RESET` +
        ` | DELAY: ${msToTime(10000)}` +
        ` | NOW: ${getTimeStamp()}`
    );

    setTimeout(async () => {
      const initResponse = await childInit(childInitParams);
      return initResponse;
    }, 10000);
  } catch (err) {
    logger.error(
      PF +
        " | *** CHILD INIT ERROR" +
        " | ERR: " +
        err +
        "\nCONFIG\n" +
        jsonPrint(config) +
        "\nENV\n" +
        jsonPrint(options.env)
    );
    throw err;
  }
}

function checkChildState(params) {
  const checkState = params.checkState;
  const noChildrenTrue = params.noChildrenTrue || false;

  return new Promise(function (resolve, reject) {
    if (Object.keys(childHashMap).length === 0) {
      resolve(noChildrenTrue);
    }

    let allCheckState = true;

    Object.keys(childHashMap).forEach(function (childId) {
      const child = childHashMap[childId];

      if (empty(child)) {
        logger.error("CHILD UNDEFINED");
        return reject(new Error("CHILD UNDEFINED"));
      }

      const cs = child.status === "DISABLED" || child.status === checkState;

      if (!cs) {
        allCheckState = false;
      }

      if (configuration.verbose) {
        logger.info(
          "checkChildState" +
            " | CH ID: " +
            childId +
            " | " +
            child.status +
            " | CHCK STATE: " +
            checkState +
            " | cs: " +
            cs +
            " | allCheckState: " +
            allCheckState
        );
      }
    });

    if (configuration.verbose) {
      logger.info(
        PF +
          " | MAIN: " +
          fsm.getMachineState() +
          " | ALL CHILDREN CHECKSTATE: " +
          checkState +
          " | " +
          allCheckState
      );
    }

    resolve(allCheckState);
  });
}

async function childPingAll(p) {
  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "PING";
  defaultCommand.now = now;
  defaultCommand.pingId = getTimeStamp();

  const command = params.command || defaultCommand;

  await childSendAll({ command: command });
  return;
}

function toggleVerbose() {
  configuration.verbose = !configuration.verbose;

  logger.info(PF + " | VERBOSE: " + configuration.verbose);

  childSendAll({ command: { op: "VERBOSE", verbose: configuration.verbose } })
    .then(function () {})
    .catch(function (err) {
      logger.error(PF + " | *** ERROR VERBOSE: " + err);
    });
}

function initStdIn() {
  logger.info(PF + " | STDIN ENABLED");
  stdin = process.stdin;
  if (stdin.setRawMode !== undefined) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding("utf8");
  stdin.on("data", async function (key) {
    switch (key) {
      case "a":
        abortCursor = true;
        logger.info(PF + " | STDIN | ABORT: " + abortCursor);
        break;

      case "K":
        quit({ cause: "STDIN K", force: true });
        break;

      case "q":
      case "Q":
        quit({ cause: "STDIN Q" });
        break;

      case "S":
      case "s":
        try {
          await showStats(key === "S");
          await printResultsHashmap();
        } catch (err) {
          logger.error(PF + " | *** SHOW STATS ERROR: " + err);
        }
        break;

      case "V":
        toggleVerbose();
        break;

      default:
        logger.info(
          "\nTNN | " +
            "q/Q: quit" +
            "\nTNN | " +
            "s: showStats" +
            "\nTNN | " +
            "S: showStats verbose" +
            "\nTNN | " +
            "V: toggle verbose"
        );
    }
  });
}

logger.info(
  "\n=======================================================================\n" +
    PF +
    " | " +
    MODULE_ID +
    " STARTED | " +
    getTimeStamp() +
    "\n=======================================================================\n"
);

logger.info(PF + " | =================================");
logger.info(PF + " | HOST:          " + hostname);
logger.info(PF + " | PROCESS TITLE: " + process.title);
logger.info(PF + " | PROCESS ID:    " + process.pid);
logger.info(PF + " | RUN ID:        " + statsObj.runId);
logger.info(
  PF +
    " | PROCESS ARGS   " +
    util.inspect(process.argv, { showHidden: false, depth: 1 })
);
logger.info(PF + " | =================================");

setTimeout(async function () {
  try {
    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    initSaveFileQueue(cnf);

    if (configuration.testMode) {
      configuration.trainingSetFile = "trainingSet_test.json";
      configuration.defaultUserArchiveFlagFile =
        "usersZipUploadComplete_test.json";
      logger.warn(PF + " | TEST MODE");
      logger.warn(
        PF + " | trainingSetFile:            " + configuration.trainingSetFile
      );
      logger.warn(
        PF +
          " | defaultUserArchiveFlagFile: " +
          configuration.defaultUserArchiveFlagFile
      );
    }

    await initSlackWebClient();
    await initSlackSendQueue();

    try {
      mongooseDb = await mgUtils.connectDb();
      await initZeroSuccessEvolveOptionsSet();
      await initFsmTickInterval(FSM_TICK_INTERVAL);
    } catch (err) {
      logger.info(
        PF + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"
      );
      quit({ cause: "MONGO DB CONNECT ERROR" });
    }
  } catch (err) {
    logger.error(PF + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err));
    if (err.code !== 404) {
      quit({ cause: "INIT CONFIG ERROR" });
    }
  }
}, 1000);
