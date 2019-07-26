/*jslint node: true */
/*jshint sub:true*/


const MODULE_NAME = "twitterNeuralNetwork";
const MODULE_ID_PREFIX = "TNN";
const CHILD_PREFIX = "tnc_node";
const CHILD_PREFIX_SHORT = "CH";

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";
const HOST = (hostname === PRIMARY_HOST) ? "default" : "local";

console.log("=========================================");
console.log("=========================================");
console.log("MODULE_NAME:  " + MODULE_NAME);
console.log("PRIMARY_HOST: " + PRIMARY_HOST);
console.log("HOST:         " + HOST);
console.log("HOST NAME:    " + hostname);
console.log("=========================================");
console.log("=========================================");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const DEFAULT_NETWORK_TECHNOLOGY = "neataptic";
const DEFAULT_ENABLE_RANDOM_NETWORK_TECHNOLOGY = false;

const DEFAULT_PURGE_MIN = true; // applies only to parent
const TEST_MODE = false; // applies only to parent
const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = false;

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const STATS_UPDATE_INTERVAL = 5*ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;
const SAVE_CACHE_DEFAULT_TTL = 60;
const DROPBOX_LIST_FOLDER_LIMIT = 50;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const OFFLINE_MODE = false;

const statsObj = {};
let statsObjSmall = {};
let configuration = {};

configuration.previousChildConfig = false;
configuration.offlineMode = OFFLINE_MODE;
configuration.primaryHost = PRIMARY_HOST;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;
configuration.enableRandomTechnology = DEFAULT_ENABLE_RANDOM_NETWORK_TECHNOLOGY;
configuration.purgeMin = DEFAULT_PURGE_MIN;
configuration.testMode = TEST_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

const path = require("path");
const watch = require("watch");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const shell = require("shelljs");
const touch = require("touch");
const kill = require("tree-kill");
const _ = require("lodash");
const treeify = require("treeify");
const objectPath = require("object-path");
const fetch = require("isomorphic-fetch"); // or another library of choice.
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const table = require("text-table");
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
const JSONParse = require("safe-json-parse");
const debug = require("debug")("TNN");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");
const omit = require("object.omit");
const omitDeep = require("omit-deep-lodash");

const cp = require("child_process");
const childHashMap = {};

const Measured = require("measured-core");
const evolveIterationMeter = new Measured.Meter({rateUnit: 60000});

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;


const EventEmitter = require("eventemitter3");
class ChildEvents extends EventEmitter {}
const childEvents = new ChildEvents();


//=========================================================================
// SLACK
//=========================================================================

const slackChannelFail = "nn-fail";
const slackChannelPassLocal = "nn-pass-local";
const slackChannelPassGlobal= "nn-pass-global";

const slackChannel = "nn";
let slackText = "";
const channelsHashMap = new HashMap();

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackConversationId = "D65CSAELX"; // wordbot
const slackRtmToken = "xoxb-209434353623-bNIoT4Dxu1vv8JZNgu7CDliy";

let slackRtmClient;
let slackWebClient;

async function slackSendRtmMessage(msg){
  console.log(chalkBlueBold("TNN | SLACK RTM | SEND: " + msg));

  const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

  console.log(chalkLog("TNN | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
  return sendResponse;
}

async function slackSendWebMessage(msgObj){
  const token = msgObj.token || slackOAuthAccessToken;
  const channel = msgObj.channel || configuration.slackChannel.id;
  const text = msgObj.text || msgObj;

  const message = {
    token: token, 
    channel: channel,
    text: text
  };

  if (msgObj.attachments !== undefined) {
    message.attachments = msgObj.attachments;
  }

  if (slackWebClient && slackWebClient !== undefined) {
    const sendResponse = await slackWebClient.chat.postMessage(message);
    return sendResponse;
  }
  else {
    console.log(chalkAlert("TNN | SLACK WEB NOT CONFIGURED | SKIPPING SEND SLACK MESSAGE\n" + jsonPrint(message)));
    return;
  }
}

function slackMessageHandler(message){
  return new Promise(function(resolve, reject){

    try {

      console.log(chalkInfo("TNN | MESSAGE | " + message.type + " | " + message.text));

      if (message.type !== "message") {
        console.log(chalkAlert("Unhandled MESSAGE TYPE: " + message.type));
        return resolve();
      }

      const text = message.text.trim();
      const textArray = text.split("|");

      const sourceMessage = (textArray[2]) ? textArray[2].trim() : "NONE";

      switch (sourceMessage) {
        case "END FETCH ALL":
        case "ERROR":
        case "FETCH FRIENDS":
        case "FSM INIT":
        case "FSM FETCH_ALL":
        case "GEN AUTO CAT":
        case "INIT CHILD":
        case "INIT LANG ANALYZER":
        case "INIT MAX INPUT HASHMAP":
        case "INIT NNs":
        case "INIT RAN NNs":
        case "INIT RNT CHILD":
        case "INIT TWITTER USERS":
        case "INIT TWITTER":
        case "INIT UNFOLLOWABLE USER SET":
        case "INIT UNFOLLOWABLE":
        case "INIT":
        case "LOAD BEST NN":
        case "LOAD NN":
        case "MONGO DB CONNECTED":
        case "PONG":
        case "QUIT":
        case "QUITTING":
        case "READY":
        case "RESET":
        case "SAV NN HASHMAP":
        case "SLACK QUIT":
        case "SLACK READY":
        case "SLACK RTM READY":
        case "START":
        case "STATS":
        case "TEXT": 
        case "UPDATE HISTOGRAMS":
        case "UPDATE NN STATS":
        case "WAIT UPDATE STATS":
        case "END UPDATE STATS":
        case "UPDATE USER CAT STATS":
          resolve();
        break;
        case "STATSUS":
          console.log(chalkInfo(message.text));
          resolve();
        break;
        case "PING":
          slackSendWebMessage(hostname + " | TNN | PONG");
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("TNN | *** UNDEFINED SLACK MESSAGE: " + message.text));
          // reject(new Error("UNDEFINED SLACK MESSAGE TYPE: " + message.text));
          resolve({text: "UNDEFINED SLACK MESSAGE", message: message});
      }
    }
    catch(err){
      reject(err);
    }

  });
}

async function initSlackWebClient(){
  try {

    const { WebClient } = require("@slack/client");
    slackWebClient = new WebClient(slackRtmToken);

    const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

    conversationsListResponse.channels.forEach(async function(channel){

      console.log(chalkLog("TNN | CHANNEL | " + channel.id + " | " + channel.name));

      if (channel.name === slackChannel) {
        configuration.slackChannel = channel;

        const message = {
          token: slackOAuthAccessToken, 
          channel: configuration.slackChannel.id,
          text: "OP"
        };

        message.attachments = [];
        message.attachments.push({
          text: "INIT", 
          fields: [ 
            { title: "SRC", value: hostname + "_" + process.pid }, 
            { title: "MOD", value: MODULE_NAME }, 
            { title: "DST", value: "ALL" } 
          ]
        });

        await slackWebClient.chat.postMessage(message);
      }

      channelsHashMap.set(channel.id, channel);

    });

    return;
  }
  catch(err){
    console.log(chalkError("TNN | *** INIT SLACK WEB CLIENT ERROR: " + err));
    throw err;
  }
}

async function initSlackRtmClient(){

  const { RTMClient } = require("@slack/client");
  slackRtmClient = new RTMClient(slackRtmToken);

  await slackRtmClient.start();

  slackRtmClient.on("slack_event", async function(eventType, event){
    switch (eventType) {
      case "pong":
        debug(chalkLog("TNN | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
      break;
      default: debug(chalkInfo("TNN | SLACK RTM EVENT | " + getTimeStamp() + " | " + eventType + "\n" + jsonPrint(event)));
    }
  });


  slackRtmClient.on("message", async function(message){
    if (configuration.verbose) { console.log(chalkLog("TNN | RTM R<\n" + jsonPrint(message))); }
    debug(`TNN | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

    try {
      await slackMessageHandler(message);
    }
    catch(err){
      console.log(chalkError("TNN | *** SLACK RTM MESSAGE ERROR: " + err));
    }

  });

  slackRtmClient.on("ready", async function(){
    if (configuration.verbose) { await slackSendRtmMessage(hostname + " | TNN | SLACK RTM READY"); }
    return;
  });
}

//=========================================================================
// HOST
//=========================================================================

const startTimeMoment = moment();

const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;
const DEFAULT_NETWORK_ID_PREFIX = hostname + "_" + getTimeStamp();

configuration.networkIdPrefix = DEFAULT_NETWORK_ID_PREFIX;

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
const DEFAULT_LOAD_ALL_INPUTS = false;
const DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY = true;
const DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY = false;
const TEST_DROPBOX_NN_LOAD = 10;
const DEFAULT_CHILD_ID_PREFIX = "tnc_node_";

if (hostname === "google") {
  configuration.cwd = "/home/tc/twitterNeuralNetwork";
}
else {
  configuration.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
}

configuration.childAppPath = configuration.cwd + "/neuralNetworkChild.js";

configuration.childIdPrefix = DEFAULT_CHILD_ID_PREFIX;
configuration.childIndex = 0;

const neataptic = require("neataptic");
const networkTech = neataptic;


let childPingAllInterval;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";

const categorizedUserHistogram = {};

categorizedUserHistogram.left = 0;
categorizedUserHistogram.right = 0;
categorizedUserHistogram.neutral = 0;
categorizedUserHistogram.positive = 0;
categorizedUserHistogram.negative = 0;
categorizedUserHistogram.none = 0;

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};
statsObj.normalization.comp = {};

statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;
statsObj.normalization.comp.min = Infinity;
statsObj.normalization.comp.max = -Infinity;

const DEFAULT_INPUT_TYPES = [
  "emoji",
  "friends",
  "hashtags",  
  "images", 
  "locations", 
  "media", 
  "mentions", 
  "places", 
  "sentiment", 
  "urls", 
  "userMentions", 
  "words"
];

DEFAULT_INPUT_TYPES.sort();

const GLOBAL_TRAINING_SET_ID = "globalTrainingSet";

const DEFAULT_SEED_RANDOMIZE_OPTIONS = false;
const DEFAULT_USE_LOCAL_TRAINING_SETS = false;
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 1;
const DEFAULT_TEST_RATIO = 0.20;
const DEFAULT_ITERATIONS = 10;
const DEFAULT_SEED_NETWORK_ID = false;
const DEFAULT_SEED_NETWORK_PROBABILITY = 0.5;
const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 75; // percent
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 50; // percent
const DEFAULT_LOCAL_MIN_SUCCESS_RATE_MSE = 40; // Harder to past with cost === MSE
const DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE = 60; // percent
const DEFAULT_DISABLE_CREATE_TEST_SET = false;
const DEFAULT_INIT_MAIN_INTERVAL = process.env.TNN_INIT_MAIN_INTERVAL || 10*ONE_MINUTE;

const DEFAULT_EVOLVE_THREADS = 4;
const DEFAULT_EVOLVE_ARCHITECTURE = "perceptron";
const DEFAULT_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO = 0.1;
const DEFAULT_EVOLVE_BEST_NETWORK = false;
const DEFAULT_EVOLVE_ELITISM = 1;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = networkTech.methods.mutation.FFW;
const DEFAULT_EVOLVE_MUTATION_RATE = 0.3;
const DEFAULT_EVOLVE_MUTATION_EFFICIENT = true; // carrot only efficientMutation
const DEFAULT_EVOLVE_POPSIZE = 50;
const DEFAULT_EVOLVE_GROWTH = 0.0001;
// const DEFAULT_EVOLVE_CLEAR = false;
const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
const EVOLVE_MUTATION_RATE_RANGE = { min: 0.35, max: 0.75 };
const DEFAULT_GROWTH = { min: 0.00005, max: 0.00015 };
const EVOLVE_GROWTH_RANGE = { min: DEFAULT_GROWTH.min, max: DEFAULT_GROWTH.max };
const EVOLVE_ELITISM_RANGE = { min: 1, max: 5 };
const DEFAULT_EVOLVE_COST_ARRAY = [
  "BINARY",
  "CROSS_ENTROPY",
  "HINGE",
  "MAE",
  "MAPE",
  "MSE"
];
const DEFAULT_EVOLVE_MOD_ACTIVATION_ARRAY = [
  "ABSOLUTE",
  "BENT_IDENTITY",
  "BIPOLAR",
  "BIPOLAR_SIGMOID",
  "GAUSSIAN",
  "HARD_TANH",
  "IDENTITY",
  "LOGISTIC",
  "RELU",
  "SELU",
  "SINUSOID",
  "SOFTSIGN",
  "STEP",
  "TANH"
];

const globalhistograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  globalhistograms[type] = {};
});

let localNetworkFile;
let networkIndex = 0;
let bestNetworkFile;

const resultsHashmap = {};
let currentBestNetwork;

const networkIdSet = new Set();
const betterChildSeedNetworkIdSet = new Set();
const skipLoadNetworkSet = new Set();

const inputsIdHashMap = {};
const inputsNoNetworksSet = new Set();
const inputsFailedSet = new Set();

const inputsSet = new Set();
const inputsNetworksHashMap = {};
const skipLoadInputsSet = new Set();

const testObj = {};
testObj.testRunId = hostname + "_" + statsObj.startTime;
testObj.results = {};
testObj.testSet = [];

configuration.quitOnComplete = QUIT_ON_COMPLETE;

configuration.processName = process.env.TNN_PROCESS_NAME || "tnn_node";
configuration.networkCreateMode = "evole";

configuration.childPingAllInterval = DEFAULT_CHILD_PING_INTERVAL;

configuration.archiveNotInInputsIdArray = DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY;
configuration.deleteNotInInputsIdArray = DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY;

configuration.globalTrainingSetId = GLOBAL_TRAINING_SET_ID;

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

const DROPBOX_CONFIG_FOLDER = "/config/utility";
const DROPBOX_CONFIG_DEFAULT_FOLDER = DROPBOX_CONFIG_FOLDER + "/default";
const DROPBOX_CONFIG_HOST_FOLDER = DROPBOX_CONFIG_FOLDER + "/" + hostname;

configuration.local = {};
configuration.local.trainingSetsFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets";
configuration.local.userArchiveFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets/users";

configuration.default = {};
configuration.default.trainingSetsFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets";
configuration.default.userArchiveFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets/users";

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = configuration[HOST].trainingSetsFolder + "/users";

configuration.userArchiveFolder = configuration.default.userArchiveFolder;

configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNumberChildren = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) 
  ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN 
  : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;


if (process.env.TNN_QUIT_ON_COMPLETE !== undefined) {

  console.log(MODULE_ID_PREFIX + " | ENV TNN_QUIT_ON_COMPLETE: " + process.env.TNN_QUIT_ON_COMPLETE);

  if (!process.env.TNN_QUIT_ON_COMPLETE || (process.env.TNN_QUIT_ON_COMPLETE === false) || (process.env.TNN_QUIT_ON_COMPLETE === "false")) {
    configuration.quitOnComplete = false;
  }
  else {
    configuration.quitOnComplete = true;
  }
}

if (process.env.TNN_SEED_RANDOMIZE_OPTIONS !== undefined) {

  console.log(MODULE_ID_PREFIX + " | ENV TNN_SEED_RANDOMIZE_OPTIONS: " + process.env.TNN_SEED_RANDOMIZE_OPTIONS);

  if (!process.env.TNN_SEED_RANDOMIZE_OPTIONS || (process.env.TNN_SEED_RANDOMIZE_OPTIONS === false) || (process.env.TNN_SEED_RANDOMIZE_OPTIONS === "false")) {
    configuration.randomizeSeedOptions = false;
  }
  else {
    configuration.randomizeSeedOptions = true;
  }
}

configuration.inputsToHiddenLayerSizeRatio = (process.env.TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO !== undefined) 
  ? process.env.TNN_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO 
  : DEFAULT_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO;

configuration.costArray = (process.env.TNN_EVOLVE_COST_ARRAY !== undefined) 
  ? process.env.TNN_EVOLVE_COST_ARRAY 
  : DEFAULT_EVOLVE_COST_ARRAY;

configuration.activationArray = (process.env.TNN_EVOLVE_MOD_ACTIVATION_ARRAY !== undefined) 
  ? process.env.TNN_EVOLVE_MOD_ACTIVATION_ARRAY 
  : DEFAULT_EVOLVE_MOD_ACTIVATION_ARRAY;

configuration.globalMinSuccessRate = (process.env.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_GLOBAL_MIN_SUCCESS_RATE 
  : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;

configuration.localMinSuccessRate = (process.env.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_LOCAL_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_MIN_SUCCESS_RATE;

configuration.localMinSuccessRateMSE = (process.env.TNN_LOCAL_MIN_SUCCESS_RATE_MSE !== undefined) 
  ? process.env.TNN_LOCAL_MIN_SUCCESS_RATE_MSE
  : DEFAULT_LOCAL_MIN_SUCCESS_RATE_MSE;

configuration.localPurgeMinSuccessRate = (process.env.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE;

configuration.loadTrainingSetFromFile = false;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

configuration.normalization = null;
configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.evolve = {};
configuration.evolve.useBestNetwork = DEFAULT_EVOLVE_BEST_NETWORK;
configuration.evolve.networkId = DEFAULT_SEED_NETWORK_ID;
configuration.evolve.threads = DEFAULT_EVOLVE_THREADS;
configuration.evolve.architecture = DEFAULT_EVOLVE_ARCHITECTURE;
configuration.evolve.networkObj = null;
configuration.evolve.elitism = DEFAULT_EVOLVE_ELITISM;
configuration.evolve.equal = DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = DEFAULT_EVOLVE_ERROR;
configuration.evolve.iterations = DEFAULT_ITERATIONS;
configuration.evolve.log = DEFAULT_EVOLVE_LOG;
configuration.evolve.mutation = DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutationRate = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.efficientMutation = DEFAULT_EVOLVE_MUTATION_EFFICIENT;
configuration.evolve.popsize = DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.growth = DEFAULT_EVOLVE_GROWTH;
configuration.evolve.cost = DEFAULT_EVOLVE_COST;

statsObj.evolveStats = {};
statsObj.evolveStats.results = {};
statsObj.evolveStats.total = 0;
statsObj.evolveStats.passLocal = 0;
statsObj.evolveStats.passGlobal = 0;
statsObj.evolveStats.fail = 0;
statsObj.evolveStats.noNetworksInputs = [];

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
  // "socketError", 
  "userReadyAck", 
  "userReadyAckWait", 
  "userReadyTransmitted",
  "networkResults"
];

statsObjSmall = pick(statsObj, statsPickArray);

function networkDefaults(networkObj){

  return new Promise(function(resolve, reject){

    if (!networkObj || networkObj === undefined) {
      console.trace(chalkError("networkDefaults ERROR: networkObj UNDEFINED"));
      return reject(new Error("networkDefaults ERROR: networkObj UNDEFINED"));
    }

    if (networkObj.networkTechnology === undefined) { networkObj.networkTechnology = "neataptic"; }
    if (networkObj.betterChild === undefined) { networkObj.betterChild = false; }
    if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
    if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
    if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
    if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
    if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

    return resolve(networkObj);
  });
}

async function printInputsObj(title, inputsObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalkNetwork;

  const numNetworks = (inputsObj.networks !== undefined) ? inputsObj.networks.length : 0;
  const numFails = (inputsObj.failNetworks !== undefined) ? inputsObj.failNetworks.length : 0;
  const totalAttempts = numNetworks + numFails;
  const percentSuccess = (totalAttempts > 0) ? 100*(numNetworks/totalAttempts) : 0;

  console.log(chalkFormat(title
    + " | NETWORKS: " + numNetworks
    + " | FAILS: " + numFails
    + " | SUCCESS: " + percentSuccess.toFixed(2) + "%"
    + " | INPUTS: " + inputsObj.meta.numInputs
    + " | " + inputsObj.inputsId
  ));
}

async function printNetworkObj(title, nObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalkNetwork;

  try {
    const networkObj = await networkDefaults(nObj);
    console.log(chalkFormat(title
      + " | TECH: " + networkObj.networkTechnology
      + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | CR: " + getTimeStamp(networkObj.createdAt)
      + " | TC:  " + networkObj.testCycles
      + " | TCH: " + networkObj.testCycleHistory.length
      + " | INPUTS: " + networkObj.numInputs
      + " | IN ID:  " + networkObj.inputsId
      + " | " + networkObj.networkId
    ));
  }
  catch(err){
    console.trace(chalkError("printNetworkObj ERROR: " + err + "\nTITLE: " + title));
  }
}

function printResultsHashmap(){

  return new Promise(function(resolve, reject){

    const tableArray = [];

    tableArray.push([
      MODULE_ID_PREFIX + " | NNID",
      "TECH",
      "STATUS",
      "BETTER",
      "SEED",
      "RES %",
      "HIDNLR",
      "INPUT ID",
      "ACTVTN",
      "CLEAR",
      "COST",
      "GRWTH",
      "EQUAL",
      "MRATE",
      "MEFCT",
      "POP",
      "ELT",
      "START",
      "ELPSD",
      "ITRNS",
      "ERROR",
      "FIT",
      "RES %"
    ]);

    async.each(Object.keys(resultsHashmap), function(networkId, cb){

      const networkObj = resultsHashmap[networkId];

      if (networkObj === undefined) {
        return cb("UNDEFINED");
      }
      
      if (networkObj.numInputs === undefined) {
        return cb("numInputs UNDEFINED");
      }
      
      if (networkObj.evolve === undefined) {
        networkObj.evolve.options.activation = "---";
        networkObj.evolve.options.clear = "---";
        networkObj.evolve.options.cost = "---";
        networkObj.evolve.options.growth = "---";
        networkObj.evolve.options.equal = "---";
        networkObj.evolve.options.mutationRate = "---";
        networkObj.evolve.options.efficientMutation = "---";
        networkObj.evolve.options.popsize = "---";
        networkObj.evolve.options.elitism = "---";
      }

      let networkTechnology = "";
      let status = "";
      let snIdRes = "";
      // let effMut = "";
      let iterations = "";
      let error = "";
      let fitness = "";
      let successRate = "";
      let elapsed = "";
      let betterChild = "";
      let hiddenLayerSize = "";
      let seedNetworkId = "";

      networkTechnology = (networkObj.networkTechnology && networkObj.networkTechnology !== undefined) ? networkObj.networkTechnology : "UNKNOWN";
      status = (networkObj.status && networkObj.status !== undefined) ? networkObj.status : "UNKNOWN";
      snIdRes = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkRes.toFixed(2) : "---";
      betterChild = (networkObj.betterChild && networkObj.betterChild !== undefined) ? networkObj.betterChild : "---";
      hiddenLayerSize = (networkObj.hiddenLayerSize && networkObj.hiddenLayerSize !== undefined) ? networkObj.hiddenLayerSize : "---";
      seedNetworkId = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkId : "---";
      iterations = (networkObj.evolve.results && networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";

      error = ((networkObj.evolve.results && networkObj.evolve.results !== undefined) 
        && (networkObj.evolve.results.error !== undefined)
        && networkObj.evolve.results.error) ? networkObj.evolve.results.error.toFixed(5) : "---";

      fitness = ((networkObj.evolve.results && networkObj.evolve.results !== undefined) 
        && (networkObj.evolve.results.fitness !== undefined)
        && networkObj.evolve.results.fitness) ? networkObj.evolve.results.fitness.toFixed(5) : "---";

      // effMut = (
      //   networkObj.evolve.effMut 
      //   && (networkObj.evolve.effMut !== undefined) 
      //   && networkObj.evolve.results.effMut 
      //   && (networkObj.evolve.results.effMut !== undefined)
      // )
      //   ? networkObj.evolve.results.effMut : false;

      successRate = ((networkObj.successRate || (networkObj.successRate === 0)) && networkObj.successRate !== undefined) ? networkObj.successRate.toFixed(2) : "---";
      elapsed = (networkObj.evolve.elapsed && networkObj.evolve.elapsed !== undefined) ? networkObj.evolve.elapsed : (moment().valueOf() - networkObj.evolve.startTime);

      tableArray.push([
        MODULE_ID_PREFIX + " | " + networkId,
        networkTechnology,
        status,
        betterChild,
        seedNetworkId,
        snIdRes,
        hiddenLayerSize,
        networkObj.inputsId,
        networkObj.evolve.options.activation,
        networkObj.evolve.options.clear,
        networkObj.evolve.options.cost,
        networkObj.evolve.options.growth.toFixed(8),
        networkObj.evolve.options.equal,
        networkObj.evolve.options.mutationRate.toFixed(3),
        networkObj.evolve.options.efficientMutation,
        networkObj.evolve.options.popsize,
        networkObj.evolve.options.elitism,
        getTimeStamp(networkObj.evolve.startTime),
        msToTime(elapsed),
        iterations,
        error,
        fitness,
        successRate
      ]);

      if (!statsObj.networkResults[networkId] || statsObj.networkResults[networkId] === undefined){
        statsObj.networkResults[networkId] = {};
        statsObj.networkResults[networkId].networkObj = {};
        statsObj.networkResults[networkId].networkObj.evolve = {};
        statsObj.networkResults[networkId].networkObj.evolve.options = {};
      }

      statsObj.networkResults[networkId].status = status;
      statsObj.networkResults[networkId].betterChild = betterChild;
      statsObj.networkResults[networkId].seedNetworkId = seedNetworkId;
      statsObj.networkResults[networkId].snIdRes = snIdRes;
      statsObj.networkResults[networkId].hiddenLayerSize = hiddenLayerSize;
      statsObj.networkResults[networkId].networkObj.evolve.options = pick(
        networkObj.evolve.options, 
        ["activation", "clear", "cost", "growth", "equal", "mutationRate", "efficientMutation", "popsize", "elitism"]
      );
      statsObj.networkResults[networkId].startTime = getTimeStamp(networkObj.evolve.startTime);
      statsObj.networkResults[networkId].elapsed = msToTime(elapsed);
      statsObj.networkResults[networkId].iterations = iterations;
      statsObj.networkResults[networkId].error = error;
      statsObj.networkResults[networkId].fitness = fitness;
      statsObj.networkResults[networkId].successRate = successRate;

      async.setImmediate(function() { cb(); });

    }, function(err){

      if (err) {
        return reject(err);
      }

      const t = table(tableArray, { 
        align: ["l", "l", "l", "l", "l", "l", "r", "l", "l", "l", "l", "l", "l", "r", "l", "r", "r", "l", "l", "r", "r", "r", "r"] 
      });

      console.log(chalkLog(MODULE_ID_PREFIX + " | === NETWORK RESULTS ========================================================================================================================"));
      console.log(chalkLog(t));
      console.log(chalkLog(MODULE_ID_PREFIX + " | ============================================================================================================================================"));

      resolve();
    });

  });
}

function purgeNetwork(networkId){

  return new Promise(function(resolve, reject){

    try {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX PURGE NETWORK: " + networkId));

      networkIdSet.delete(networkId);

      betterChildSeedNetworkIdSet.delete(networkId);

      skipLoadNetworkSet.add(networkId);

      if (resultsHashmap[networkId] !== undefined) { 
        resultsHashmap[networkId].status = "PURGED";
      }
      resolve();
    }
    catch(err){
      return reject(err);
    }

  });
}

function purgeInputs(inputsId){

  return new Promise(function(resolve, reject){

    try {
      if (!configuration.inputsIdArray.includes(inputsId)){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX PURGE INPUTS: " + inputsId));
        inputsSet.delete(inputsId);
        inputsNoNetworksSet.delete(inputsId);
        skipLoadInputsSet.add(inputsId);
        delete inputsIdHashMap[inputsId];
      }
      else {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | ** NO XXX PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" 
          + " | INPUTS ID: " + inputsId
        ));

        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIGURATION INPUTS ID ARRAY\n" + jsonPrint(configuration.inputsIdArray) ));
        }
      }
      resolve();
    }
    catch(err){
      return reject(err);
    }

  });
}

async function updateDbInputs(p){

  // return new Promise(function(resolve, reject){

    const params = p || {};

    if (!params.inputsObj || params.inputsObj === undefined) {
      throw new Error("undefined params.inputsObj");
    }

    if (!params.inputsObj.inputsId || params.inputsObj.inputsId === undefined) {
      throw new Error("undefined params.inputsObj.inputsId");
    }

    if (!params.inputsObj.meta || params.inputsObj.meta === undefined) {
      throw new Error("undefined params.inputsObj.meta");
    }

    if (!params.inputsObj.inputs || params.inputsObj.inputs === undefined) {
      throw new Error("undefined params.inputsObj.inputs");
    }

    if (params.inputsObj.networks === undefined) {
      params.inputsObj.networks = [];
    }

    if (params.inputsObj.failNetworks === undefined) {
      params.inputsObj.failNetworks = [];
    }

    const query = { inputsId: params.inputsObj.inputsId };

    try{

      const inputsObj = await global.globalNetworkInputs.findOne(query);

      if (inputsObj) {

        if (inputsObj.networks === undefined) {
          inputsObj.networks = [];
        }

        if (inputsObj.failNetworks === undefined) {
          inputsObj.failNetworks = [];
        }

        if (params.networkId && !inputsObj.networks.includes(params.networkId)) {
          inputsObj.networks.push(params.networkId);
        }

        if (params.failNetworkId && !inputsObj.networks.includes(params.failNetworkId)) {
          inputsObj.failNetworks.push(params.failNetworkId);
        }

        inputsObj.networks = _.union(params.inputsObj.networks, inputsObj.networks);
        inputsObj.failNetworks = _.union(params.inputsObj.failNetworks, inputsObj.failNetworks);

        const niDbUpdated = await inputsObj.save();

        if (verbose) { printInputsObj(MODULE_ID_PREFIX + " | +++ INPUTS DB UPDATED", niDbUpdated); }

        return niDbUpdated;
      }
      else{

        if (params.networkId && !params.inputsObj.networks.includes(params.networkId)) {
          params.inputsObj.networks.push(params.networkId);
        }
        if (params.failNetworkId && !params.inputsObj.failNetworks.includes(params.failNetworkId)) {
          params.inputsObj.failNetworks.push(params.failNetworkId);
        }

        const ni = new global.globalNetworkInputs(params.inputsObj);

        const niDbUpdated = await ni.save();

        if (verbose) { printInputsObj(MODULE_ID_PREFIX + " | +++ INPUTS DB UPDATED", niDbUpdated); }

        return niDbUpdated;
      }

    }
    catch(e){
      console.log(chalkError("*** updateDbInputs | INPUTS FIND ONE ERROR: " + e
        + "\nINPUTS ID: " + params.inputsObj.inputsId
      ));
      console.log(e);
      throw e;
    }
}

async function loadNetworkDropboxFile(params){

  const path = params.folder + "/" + params.file;

    const fileObj = await loadFileRetry({folder: params.folder, file: params.file, includeMetaData: true});

    let networkObj = fileObj.data;
    const entry = fileObj.meta;
    const networkId = params.file.replace(".json", "");

    networkObj = await validateNetwork({networkId: networkId, networkObj: networkObj});

    if (!networkObj || networkObj === undefined) {  
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ??? INVALID NETWORK ... PURGING"
        + " | " + path
      ));
      await purgeNetwork(networkId);
      return;
    }

    const dbInputsObj = await updateDbInputs({inputsObj: networkObj.inputsObj, networkId: networkObj.networkId});

    const inputsObj = dbInputsObj.toObject();

    if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {

      if (configuration.archiveNotInInputsIdArray && path.toLowerCase().includes(localBestNetworkFolder.toLowerCase())){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | 000 NN INPUTS NOT IN INPUTS ID ARRAY ... ARCHIVING"
          + " | NUM INPUTS: " + networkObj.numInputs
          + " | INPUTS ID: " + networkObj.inputsId
          + " | " + path
        ));
        await dropboxFileMove({srcFolder: localBestNetworkFolder, srcFile: params.file, dstFolder: localArchiveNetworkFolder, dstFile: params.file});
        return;
      }
      else if (configuration.deleteNotInInputsIdArray && path.toLowerCase().includes(localBestNetworkFolder.toLowerCase())){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING"
          + " | NUM INPUTS: " + networkObj.numInputs
          + " | INPUTS ID: " + networkObj.inputsId
          + " | " + path
        ));
        await dropboxFileDelete({folder: localBestNetworkFolder, file: params.file});
        return;
      }

      console.log(chalkInfo(MODULE_ID_PREFIX + " | --- NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
        + " | NUM INPUTS: " + networkObj.numInputs
        + " | INPUTS ID: " + networkObj.inputsId
        + " | " + path
      ));

      skipLoadNetworkSet.add(networkObj.networkId);
      return;
    }

    //========================
    // SAVE LOCAL NETWORK TO GLOBAL
    //========================

    if ((params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase())
      && !networkIdSet.has(networkObj.networkId)
      && ((networkObj.successRate >= configuration.globalMinSuccessRate) 
      || (networkObj.overallMatchRate >= configuration.globalMinSuccessRate))) {

      networkIdSet.add(networkObj.networkId);

      if (inputsIdHashMap[networkObj.inputsId] === undefined) { inputsIdHashMap[networkObj.inputsId] = new Set(); }
      inputsIdHashMap[networkObj.inputsId].add(networkObj.networkId);

      printNetworkObj(MODULE_ID_PREFIX 
        + " | LOCAL > GLOBAL"
        + " | " + params.folder, 
        networkObj, 
        chalkGreen
      );

      saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: entry.name, obj: networkObj});
      await dropboxFileDelete({folder: params.folder, file: entry.name});
    }

    //========================
    // NETWORK MISMATCH GLOBAL/LOCAL
    //========================

    // const networkHashResult = await checkNetworkHash({entry: entry});

    // if (networkHashResult === "mismatch"){
    //   console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX GLOBAL/LOCAL NETWORK MISMATCH ... DELETING"
    //     + " | INPUTS: " + networkObj.numInputs
    //     + " | INPUTS ID: " + networkObj.inputsId
    //     + " | " + entry.path_display
    //   ));
    //   await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
    //   return resolve(null);
    // }

    //========================
    // NETWORK PASS SUCCESS or MATCH MIN
    //========================

    const passed = networkPass({folder: params.folder, purgeMin: params.purgeMin, networkObj: networkObj});

    if (passed) {

      networkIdSet.add(networkObj.networkId);

      if (inputsIdHashMap[networkObj.inputsId] === undefined) { inputsIdHashMap[networkObj.inputsId] = new Set(); }
      inputsIdHashMap[networkObj.inputsId].add(networkObj.networkId);

      printNetworkObj(MODULE_ID_PREFIX + " | +++ NN SET [" + networkIdSet.size + " IN SET]", networkObj);

      if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {
        currentBestNetwork = networkObj;
        printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN", networkObj, chalkGreen);
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

      if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
        inputsNetworksHashMap[networkObj.inputsId] = new Set();
      }

      inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

      //========================
      // UPDATE DB
      //========================
      let nnDb;

      try {
        nnDb = await updateDbNetwork({networkObj: networkObj, addToTestHistory: true});
      }
      catch(err){
        console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
        throw err;
      }

      if (nnDb) {

        if (!currentBestNetwork || (nnDb.overallMatchRate > currentBestNetwork.overallMatchRate)) {
          currentBestNetwork = nnDb;
          printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN (DB)", nnDb, chalkGreen);
        }

        networkIdSet.add(nnDb.networkId);

        if (inputsIdHashMap[nnDb.inputsId] === undefined) { inputsIdHashMap[nnDb.inputsId] = new Set(); }
        inputsIdHashMap[nnDb.inputsId].add(nnDb.networkId);

      }

      return nnDb;
    }

    //========================
    // PURGE FAILING NETWORKS
    //========================

    if (((hostname === PRIMARY_HOST) && (params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()))
      || ((hostname !== PRIMARY_HOST) && (params.folder.toLowerCase() === localBestNetworkFolder.toLowerCase())) ) {

      printNetworkObj(
        MODULE_ID_PREFIX 
          + " | XXX DELETING NN [" + networkIdSet.size + " IN SET]"
          + " | FOLDER: " + params.folder, 
        networkObj, 
        chalkAlert
      );

      await purgeNetwork(networkObj.networkId);
      await purgeInputs(networkObj.inputsId);
      await dropboxFileDelete({folder: params.folder, file: entry.name});
      return;
    }

    printNetworkObj(
      MODULE_ID_PREFIX 
        + " | --- NN HASH MAP [" + networkIdSet.size + " IN SET]"
        + " | PRIMARY_HOST: " + PRIMARY_HOST
        + " | FOLDER: " + params.folder, 
      networkObj, 
      chalkLog
    );

    return networkObj;

}

async function loadInputsDropboxFile(params){

    let inputsObj;

    try {
      inputsObj = await loadFileRetry({folder: params.folder, file: params.file});
    }
    catch(err) {
      console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
      throw err;
    }

    if ((inputsObj === undefined) || !inputsObj) {
      console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
      throw new Error("JSON UNDEFINED");
    }

    if (inputsObj.meta === undefined) {
      inputsObj.meta = {};
      inputsObj.meta.numInputs = 0;
      Object.keys(inputsObj.inputs).forEach(function(inputType){
        inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
      });
    }

    let dbInputsObj;

    try {
      dbInputsObj = await updateDbInputs({inputsObj: inputsObj});
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | DB INPUTS UPDATE ERROR: " + err));
      throw err;
    }

    inputsSet.add(dbInputsObj.inputsId);

    if ((dbInputsObj.networks.length === 0) 
      && ((dbInputsObj.failNetworks === undefined) || (dbInputsObj.failNetworks.length === 0))){
      inputsNoNetworksSet.add(dbInputsObj.inputsId);
      console.log(chalkBlueBold(MODULE_ID_PREFIX 
        + " | +++ NO NETWORKS INPUTS [" + inputsNoNetworksSet.size + " IN SET]"
        + " | " + dbInputsObj.meta.numInputs
        + " INPUTS | " + dbInputsObj.inputsId
      ));
    }
    else {
      inputsNoNetworksSet.delete(dbInputsObj.inputsId);
    }

    if (inputsNetworksHashMap[dbInputsObj.inputsId] === undefined) {
      inputsNetworksHashMap[dbInputsObj.inputsId] = new Set();
    }

    console.log(chalkInfo(MODULE_ID_PREFIX
      + " | +++ INPUTS [" + inputsSet.size + " IN HM]"
      + " | " + dbInputsObj.meta.numInputs + " INPUTS"
      + " | " + dbInputsObj.inputsId
    ));

    return inputsObj;

}

async function updateDbNetwork(params) {

  statsObj.status = "UPDATE DB NETWORKS";

  if (configuration.verbose) {
    printNetworkObj(MODULE_ID_PREFIX + " | [" + networkIdSet.size + "] >>> UPDATE NN DB", params.networkObj);
  }

  const networkObj = params.networkObj;
  const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
  const testHistoryItem = (params.testHistoryItem !== undefined) ? params.testHistoryItem : false;
  const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : true;
  const verbose = params.verbose || false;

  const query = { networkId: networkObj.networkId };

  const update = {};

  update.$setOnInsert = { 
    networkTechnology: networkObj.networkTechnology,
    seedNetworkId: networkObj.seedNetworkId,
    seedNetworkRes: networkObj.seedNetworkRes,
    network: networkObj.network,
    successRate: networkObj.successRate, 
    numInputs: networkObj.numInputs,
    numOutputs: networkObj.numOutputs,
    inputsId: networkObj.inputsId,
    inputsObj: networkObj.inputsObj,
    outputs: networkObj.outputs,
    evolve: networkObj.evolve,
    test: networkObj.test
  };

  update.$set = { 
    matchRate: networkObj.matchRate, 
    overallMatchRate: networkObj.overallMatchRate,
  };

  if (incrementTestCycles) { update.$inc = { testCycles: 1 }; }
  
  if (testHistoryItem) { 
    update.$push = { testCycleHistory: testHistoryItem };
  }
  else if (addToTestHistory) {
    update.$addToSet = { testCycleHistory: { $each: networkObj.testCycleHistory } };
  }

  const options = {
    new: true,
    returnOriginal: false,
    upsert: true,
    setDefaultsOnInsert: true
  };

  global.globalNeuralNetwork.findOneAndUpdate(query, update, options, function(err, nnDbUpdated){

    if (err) {
      console.log(chalkError("*** updateDbNetwork | NETWORK FIND ONE ERROR: " + err));
      throw err;
    }

    if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | +++ NN DB UPDATED", nnDbUpdated); }

    const nnObj = deepcopy(nnDbUpdated.toObject());
    delete nnObj._id;

    return nnObj;
  });

}

function listDropboxFolders(params){

  return new Promise(function(resolve, reject){

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... GETTING DROPBOX FOLDERS ENTRIES"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    let totalEntries = [];
    const promiseArray = [];

    params.folders.forEach(async function(folder){

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... GETTING DROPBOX FOLDERS ENTRIES"
        + " | FOLDER: " + folder
      ));

      const listDropboxFolderParams = {
        folder: folder,
        limit: DROPBOX_LIST_FOLDER_LIMIT
      };

      try {
        const p = listDropboxFolder(listDropboxFolderParams);
        promiseArray.push(p);
      }
      catch(err){
        return reject(err);
      }

    });

    Promise.all(promiseArray).
    then(function(results){
      results.forEach(function(folderListing){
        console.log(chalkLog(MODULE_ID_PREFIX + " | RESULTS | ENTRIES: " + folderListing.entries.length));
        // console.log(chalkLog(MODULE_ID_PREFIX + " | RESULTS | folderListing ENTRY\n"  + jsonPrint(folderListing.entries[0])));
        totalEntries = _.concat(totalEntries, folderListing.entries);
      });
      resolve(totalEntries);
    }).
    catch(function(err){
      reject(err);
    });

  });
}

function validateNetwork(params){

  return new Promise(function(resolve, reject){

    if (!params || params === undefined || params.networkObj === undefined || params.networkId === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | validateNetwork *** PARAMS UNDEFINED ???\nPARAMS\n" + jsonPrint(params)));
      return reject(new Error("params undefined"));
    }

    const networkObj = params.networkObj;

    if (networkObj.networkId !== params.networkId) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK ID MISMATCH"
        + " | " + networkObj.networkId 
        + " | " + params.networkId
      ));
      return resolve();
    }

    if (networkObj.numInputs === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK NETWORK numInputs UNDEFINED"
        + " | " + networkObj.networkId
      ));
      return resolve();
    }

    if (networkObj.inputsId === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS ID UNDEFINED"
        + " | " + networkObj.networkId));
      return resolve();
    }

    if (networkObj.inputsObj === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS OBJ UNDEFINED"
        + " | " + networkObj.networkId));
      return resolve();
    }

    try {
      const nnObj = networkDefaults(networkObj);
      
      delete nnObj._id;

      resolve(nnObj);
    }
    catch(err){
      console.trace(chalkError("validateNetwork ERROR: " + err));
      return;
    }


  });
}

function dropboxFileMove(params){

  return new Promise(function(resolve, reject){

    if (!params || !params.srcFolder || !params.srcFile || !params.dstFolder || !params.dstFile) {
      return reject(new Error("params undefined"));
    }

    const srcPath = params.srcFolder + "/" + params.srcFile;
    const dstPath = params.dstFolder + "/" + params.dstFile;

    dropboxClient.filesMoveV2({from_path: srcPath, to_path: dstPath}).
    then(function(response){
      console.log(chalkLog(MODULE_ID_PREFIX + " | ->- DROPBOX FILE MOVE"
        + " | " + srcPath
        + " > " + dstPath
      ));
      debug("dropboxClient filesMoveV2 response\n" + jsonPrint(response));
      return resolve();
    }).
    catch(function(err){
      if (err.status === 409) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE MOVE"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | DEST EXISTS"
        ));
      }
      else if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** MOVE ERROR:"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** MOVE ERROR:"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | SUMMARY: " + err.response.statusText
        ));
      }
      return reject(err);
    });

  });
}

function dropboxFileDelete(params){

  return new Promise(function(resolve, reject){

    if (!params || !params.folder || !params.file) {
      return reject(new Error("params undefined"));
    }

    const path = params.folder + "/" + params.file;

    dropboxClient.filesDelete({path: path}).
    then(function(response){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DROPBOX FILE DELETE"
        + " | " + path
      ));
      debug("dropboxClient filesDelete response\n" + jsonPrint(response));
      return resolve();
    }).
    catch(function(err){
      if (err.status === 409) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE DELETE"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | DOES NOT EXIST"
        ));
        if (params.noErrorNotFound) {
          return resolve();
        }
      }
      else if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DELETE ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DELETE ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | ERR: " + err
          + "\n" + jsonPrint(err)
        ));
      }
      return reject(err);
    });

  });
}

function networkPass(params) {
  const pass = 
       ((params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()) && (params.networkObj.successRate >= configuration.globalMinSuccessRate))
    || ((params.folder.toLowerCase() === globalBestNetworkFolder.toLowerCase()) && (params.networkObj.matchRate >= configuration.globalMinSuccessRate))
    || (params.purgeMin && (params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase()) && (params.networkObj.overallMatchRate === 0) && (params.networkObj.matchRate === 0) && (params.networkObj.successRate >= configuration.localPurgeMinSuccessRate))
    || (params.purgeMin && (params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase()) && (params.networkObj.overallMatchRate === 0) && (params.networkObj.matchRate >= configuration.localPurgeMinSuccessRate))
    || (!params.purgeMin && (params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase()) && (params.networkObj.successRate >= configuration.localMinSuccessRate))
    || (!params.purgeMin && (params.folder.toLowerCase() !== globalBestNetworkFolder.toLowerCase()) && (params.networkObj.matchRate >= configuration.localMinSuccessRate));

  return pass;
}

function loadBestNetworkDropboxFolders (p){

  return new Promise(function(resolve, reject){

    const params = p || {};

    let numNetworksLoaded = 0;

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING DROPBOX NETWORK FOLDERS"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    listDropboxFolders(params)
    .then(function(dbEntries){

      let dropboxFoldersEntries = dbEntries;

      if (configuration.testMode) {
        dropboxFoldersEntries = _.shuffle(dbEntries);
        dropboxFoldersEntries.length = 10;
      }

      async.eachSeries(dropboxFoldersEntries, function(entry, cb){

        if (configuration.testMode && (numNetworksLoaded >= TEST_DROPBOX_NN_LOAD)) {
          return cb("TEST_MODE");
        }

        if (entry.name.toLowerCase() === bestRuntimeNetworkFileName.toLowerCase()) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
          return cb();
        }

        if (!entry.name.endsWith(".json")) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
          return cb();
        }

        const folder = path.dirname(entry.path_display);

        const entryNameArray = entry.name.split(".");
        const networkId = entryNameArray[0];

        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK FOUND"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + networkId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
        }

        if (skipLoadNetworkSet.has(networkId)){
          console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK IN SKIP SET | SKIPPING ..."
            + " | " + networkId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
          return cb();
        }
        
        loadNetworkDropboxFile({folder: folder, file: entry.name, purgeMin: params.purgeMin}).
        then(function(networkObj){
          if (networkObj) {
            numNetworksLoaded += 1;
          }
          cb();
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK DROPBOX ENTRY ERROR: " + err
            + " | " + networkId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
          cb(err);
        });
      }, function(err){
        if (err) { 
          if (err == "TEST_MODE") {
            console.log(chalkInfo(MODULE_ID_PREFIX + " | !!! TEST MODE | LOADED " + numNetworksLoaded + " NNs"));
            resolve(numNetworksLoaded);
          }
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR LOAD DROPBOX FOLDERS: " + err)); 
          return reject(err);
        }
        return resolve(numNetworksLoaded);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function loadInputsDropboxFolders (p){

  return new Promise(function(resolve, reject){

    const params = p || {};

    let numInputsLoaded = 0;

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING DROPBOX INPUTS FOLDERS"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    // dropboxFoldersEntries = await listDropboxFolders(params);
    listDropboxFolders(params)
    .then(function(dbEntries){

      let dropboxFoldersEntries = dbEntries;
      if (configuration.testMode) {
        dropboxFoldersEntries = _.shuffle(dbEntries);
        dropboxFoldersEntries.length = 10;
      }

      async.eachSeries(dropboxFoldersEntries, function(entry, cb){

        if (!entry.name.endsWith(".json")) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
          return cb();
        }

        const folder = path.dirname(entry.path_display);

        const entryNameArray = entry.name.split(".");
        const inputsId = entryNameArray[0];

        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS FOUND"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + inputsId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
        }

        if (!configuration.inputsIdArray.includes(inputsId)){
          console.log(chalkInfo(MODULE_ID_PREFIX + " | --- ARCHIVE INPUTS ... NOT IN INPUTS ARRAY"
            + " | " + inputsId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));

          dropboxFileDelete({folder: globalArchiveInputsFolder, file: entry.name, noErrorNotFound: true}).
          then(function(){
            dropboxFileMove({srcFolder: folder, srcFile: entry.name, dstFolder: globalArchiveInputsFolder, dstFile: entry.name}).
            then(function(){
              return cb();
            })
          }).
          catch(function(err){
            if (err.status === 429) {
              setTimeout(function(){
                return cb();
              }, 5000);
            }
            else {
              return cb(err);
            }
          });
        }
        
        loadInputsDropboxFile({folder: folder, file: entry.name, purgeMin: params.purgeMin}).
        then(function(inputsObj){
          if (inputsObj) {
            numInputsLoaded += 1;
          }
          return cb();
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD INPUTS DROPBOX ENTRY ERROR: " + err
            + " | " + inputsId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
          return cb(err);
        });

      }, function(err){
        if (err) { 
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR LOAD INPUTS FOLDERS: " + err)); 
          return reject(err);
        }
        resolve(numInputsLoaded);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

function initWatch(params){

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT WATCH\n" + jsonPrint(params)));

  watch.createMonitor(params.rootFolder, watchOptions, function (monitor) {

    const loadArchive = async function (f) {

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

      if (f.endsWith(configuration.defaultUserArchiveFlagFile)){

        console.log(chalkLog(MODULE_ID_PREFIX + " | LOAD USER ARCHIVE FLAG FILE: " + params.rootFolder + "/" + configuration.defaultUserArchiveFlagFile));

        let archiveFlagObj;

        try {
          archiveFlagObj = await loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
          console.log(chalkLog(MODULE_ID_PREFIX + " | USER ARCHIVE FLAG FILE"
            + " | " + archiveFlagObj.file 
            + " | SIZE: " + archiveFlagObj.size
            + "\nHISTOGRAM\n" + jsonPrint(archiveFlagObj.histogram)
          ));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** WATCH CHANGE ERROR | " + getTimeStamp() + " | " + err));
        }

      }
    };

    monitor.on("created", loadArchive);

    monitor.on("changed", loadArchive);

    monitor.on("removed", function (f) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });

  });
}

function generateSeedInputsNetworkId(params){

  return new Promise(function(resolve, reject){

    const config = params.config || {};

    //
    // if available use better child as seed nn
    //

    if (betterChildSeedNetworkIdSet.size > 0) {

      config.seedNetworkId = betterChildSeedNetworkIdSet.keys().next().value;
      config.isBetterChildSeed = true;

      betterChildSeedNetworkIdSet.delete(config.seedNetworkId);

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | USING BETTER CHILD SEED"
        + " [" + betterChildSeedNetworkIdSet.size + "] SEED: " + config.seedNetworkId
      ));

      return resolve(config);
    }
    
    //
    // no better children, so try an input set with no networks
    //
    
    const noNetworksInputsIdArray = [...inputsNoNetworksSet].sort();
    const failedInputsIdArray = [...inputsFailedSet];
    const availableInputsIdArray = _.difference(noNetworksInputsIdArray, failedInputsIdArray);

    if (availableInputsIdArray.size > 0) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | AVAILABLE NO NETWORKS INPUTS: " + availableInputsIdArray.length));

      availableInputsIdArray.sort();

      config.seedInputsId = availableInputsIdArray.pop(); // most recent input

      console.log(chalkBlueBold(MODULE_ID_PREFIX
        + " | NO NETWORKS RANDOM INPUT"
        + " | INPUT NO NETWORKS SET: " + inputsNoNetworksSet.size
        + " | AVAIL NO NETWORKS INPUTS: " + availableInputsIdArray.length
        + " | " + config.seedInputsId
      ));

      return resolve(config);
    }

    //
    // no input set with no networks, so maybe random network
    //
    
    const useRandomNetwork = (Math.random() <= configuration.seedNetworkProbability);

    if (useRandomNetwork && (Object.keys(inputsIdHashMap).length > 0)) {

      const randomInputsId = randomItem(Object.keys(inputsIdHashMap));
      const randomNetworkIdSet = inputsIdHashMap[randomInputsId];
      const randomNetworkId = randomItem([...randomNetworkIdSet]);

      config.seedNetworkId = randomNetworkId;
      config.isBetterChildSeed = false;
      return resolve(config);
    }

    //
    // no random network, so random inputSet
    //
    
    if (inputsSet.size === 0) {
      console.log(chalkError(MODULE_ID_PREFIX
        + " | *** EMPTY INPUTS SET [" + inputsSet.size + "]"
      ));
      return reject(new Error("EMPTY INPUTS SET"));
    }
    config.seedInputsId = randomItem([...inputsSet]);

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | RANDOM INPUT [" + inputsSet.size + "]"
      + " | " + config.seedInputsId
    ));

    resolve(config);

  });
}

function calculateHiddenLayerSize(params){
  return new Promise(function(resolve){

    const networkObj = params.networkObj;

    let hiddenLayerSize = 0;

    networkObj.network.nodes.forEach(function(node){
      if (node.type === "hidden") { hiddenLayerSize += 1; }
    });

    resolve(hiddenLayerSize);

  });
}

async function generateRandomEvolveConfig (){

  statsObj.status = "GENERATE EVOLVE CONFIG";

  console.log(chalkAlert(MODULE_ID_PREFIX + " | GENERATE RANDOM EVOLVE CONFIG"));

  let config = {};

  config.networkCreateMode = "evolve";
  config.networkTechnology = (configuration.enableRandomTechnology) ? randomItem(["neataptic", "carrot"]) : configuration.networkTechnology;
  console.log(chalkAlert(MODULE_ID_PREFIX + " | NETWORK TECHNOLOGY: " + config.networkTechnology));

  debug(chalkLog(MODULE_ID_PREFIX + " | NETWORK CREATE MODE: " + config.networkCreateMode));

  config = await generateSeedInputsNetworkId({config: config});

  config.activation = randomItem(configuration.activationArray);
  config.clear = randomItem([true, false]);
  config.cost = randomItem(configuration.costArray);
  config.efficientMutation = configuration.evolve.efficientMutation;
  config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);
  config.equal = true;
  config.error = configuration.evolve.error;
  config.fitnessPopulation = false;
  config.growth = randomFloat(EVOLVE_GROWTH_RANGE.min, EVOLVE_GROWTH_RANGE.max);
  config.iterations = configuration.evolve.iterations;
  config.log = configuration.evolve.log;
  config.mutation = DEFAULT_EVOLVE_MUTATION;
  config.mutationAmount = 1;
  config.mutationRate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  config.popsize = configuration.evolve.popsize;
  config.provenance = 0;
  config.threads = configuration.evolve.threads;

  if (configuration.enableSeedNetwork && config.seedNetworkId && networkIdSet.has(config.seedNetworkId)) {

    let networkObj = {};

    try{
      const dbNetworkObj = await global.globalNeuralNetwork.findOne({ networkId: config.seedNetworkId });

      if (!dbNetworkObj) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DB FIND NN ERROR | " + config.seedNetworkId));
        throw new Error("NN not found: " + networkObj.inputsId);
      }

      networkObj = deepcopy(dbNetworkObj.toObject());
      delete networkObj._id;

      if (!networkObj.hiddenLayerSize || (networkObj.hiddenLayerSize === undefined)){
        config.hiddenLayerSize = await calculateHiddenLayerSize({networkObj: networkObj});
        networkObj.hiddenLayerSize = config.hiddenLayerSize;
      }
      else{
        config.hiddenLayerSize = networkObj.hiddenLayerSize;
      }
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DB FIND NN ERROR | " + config.seedNetworkId));
      throw new Error("NN not found: " + networkObj.inputsId);
    }

    config.networkObj = deepcopy(networkObj);
    config.architecture = "loadedNetwork";
    config.inputsId = networkObj.inputsId;
    config.inputsObj = {};
    config.inputsObj = deepcopy(networkObj.inputsObj);


    console.log(MODULE_ID_PREFIX + " | SEED NETWORK: " + config.networkObj.networkId);
    console.log(MODULE_ID_PREFIX + " | HIDDEN NODES: " + networkObj.hiddenLayerSize);
    console.log(MODULE_ID_PREFIX + " | SEED INPUTS | " + networkObj.inputsId);

    if (configuration.randomizeSeedOptions) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId));
      config.activation = randomItem([config.activation, networkObj.evolve.options.activation]);
      config.clear = randomItem([config.clear, networkObj.evolve.options.clear]);
      config.cost = randomItem([config.cost, networkObj.evolve.options.cost]);
      config.elitism = randomItem([config.elitism, networkObj.evolve.options.elitism]);
      config.equal = randomItem([config.equal, networkObj.evolve.options.equal]);
      config.error = randomItem([config.error, networkObj.evolve.options.error]);
      config.growth = randomItem([config.growth, networkObj.evolve.options.growth]);
      config.mutationRate = randomItem([config.mutationRate, networkObj.evolve.options.mutationRate]);
    }
    else {
      console.log(chalkLog(MODULE_ID_PREFIX + " | USE SEED NETWORK OPTIONS | " + config.seedNetworkId));
      config.activation = networkObj.evolve.options.activation;
      config.clear = networkObj.evolve.options.clear;
      config.cost = networkObj.evolve.options.cost;
      config.elitism = networkObj.evolve.options.elitism;
      config.equal = networkObj.evolve.options.equal;
      config.error = networkObj.evolve.options.error;
      config.growth = networkObj.evolve.options.growth;
      config.mutationRate = networkObj.evolve.options.mutationRate;
    }
  }
  else {
    if (inputsSet.has(config.seedInputsId)) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | USE SEED INPUTS ID | " + config.seedInputsId));

      config.inputsObj = {};

      try{
        const inputsObj = await global.globalNetworkInputs.findOne({inputsId: config.seedInputsId});

        if (!inputsObj) {
          console.log(chalkError("TNN | *** LOAD INPUTS ERROR | NOT FOUND"
            + " | INPUTS ID: " + config.seedInputsId
          ));
          throw new Error(config.seedInputsId + " NOT IN inputsSet");
        }

        config.inputsObj = inputsObj.toObject();

      }
      catch(err){
        console.log(chalkError("TNN | *** LOAD INPUTS ERROR"
          + " | INPUTS ID: " + config.seedInputsId
          + " | ERROR: " + err
        ));
        throw new Error(config.seedInputsId + " NOT IN inputsSet");
      }

      config.architecture = "perceptron";

      config.hiddenLayerSize = parseInt((configuration.inputsToHiddenLayerSizeRatio * config.inputsObj.meta.numInputs) + 3);
      config.hiddenLayerSize = randomItem([0,config.hiddenLayerSize]);

      config.inputsId = config.seedInputsId;

      debug(MODULE_ID_PREFIX + " | PERCEPTRON ARCH | SEED INPUTS: " + config.seedInputsId);
    }
    else {
      console.log("TNN | *** ERROR *** | PERCEPTRON ARCH | seedInputsId " + config.seedInputsId + " NOT IN inputsSet");
      throw new Error(config.seedInputsId + " NOT IN inputsSet");
    }
  }

  return config;

}

async function initNetworkCreate(params){

  const childId = params.childId;
  const networkId = params.networkId;
  const compareTechFlag = params.compareTechFlag;

  statsObj.status = "INIT NETWORK CREATE";

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT NETWORK CREATE"
    + " | CHILD " + childId
    + " | NNC ID: " + networkId
    + " | COMPARE TECH: " + compareTechFlag
  ));

  let messageObj;
  let networkCreateObj = {};

  let childConf;

  try {

    if (compareTechFlag && configuration.previousChildConfig && configuration.enableRandomTechnology) {

      console.log(chalkAlert("TNN | PREV CHILD CONF TECH: " + configuration.previousChildConfig.networkTechnology));

      childConf = configuration.previousChildConfig;

      if (configuration.previousChildConfig.networkTechnology === "neataptic") {
        childConf.networkTechnology = "carrot";
      }
      else {
        childConf.networkTechnology = "neataptic";
      }

      configuration.previousChildConfig = false;
    }
    else {
      childConf = await generateRandomEvolveConfig();
      configuration.previousChildConfig = childConf;
    }

    switch (configuration.networkCreateMode) {

      case "evolve":

        statsObj.status = "EVOLVE";

        messageObj = {};
        messageObj = childConf;

        messageObj.childId = childId;
        messageObj.op = "CONFIG_EVOLVE";
        messageObj.testRunId = networkId;
        messageObj.outputs = {};
        messageObj.outputs = ["left", "neutral", "right"];

        messageObj.betterChild = false;
        messageObj.seedNetworkRes = 0;

        if (childConf.seedNetworkId && (messageObj.networkObj !== undefined)) {
          messageObj.seedNetworkRes = messageObj.networkObj.successRate;
        }

        console.log(chalkBlue("\nTNN | START NETWORK EVOLVE"));

        console.log(chalkBlue(
                   MODULE_ID_PREFIX + " | NN ID:             " + networkId
          + "\n" + MODULE_ID_PREFIX + " | TECHNOLOGY:        " + messageObj.networkTechnology
          + "\n" + MODULE_ID_PREFIX + " | ARCHITECTURE:      " + messageObj.architecture
          + "\n" + MODULE_ID_PREFIX + " | INPUTS ID:         " + messageObj.inputsId
          + "\n" + MODULE_ID_PREFIX + " | INPUTS:            " + messageObj.inputsObj.meta.numInputs
          + "\n" + MODULE_ID_PREFIX + " | HIDDEN LAYER SIZE: " + messageObj.hiddenLayerSize
          + "\n" + MODULE_ID_PREFIX + " | EFF MUTATION:      " + messageObj.efficientMutation
          + "\n" + MODULE_ID_PREFIX + " | ACTIVATION:        " + messageObj.activation
          + "\n" + MODULE_ID_PREFIX + " | COST:              " + messageObj.cost
          + "\n" + MODULE_ID_PREFIX + " | ITERATIONS:        " + messageObj.iterations
        ));

        if (messageObj.seedNetworkId) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | SEED:                " + messageObj.seedNetworkId 
            + " | SR: " + messageObj.seedNetworkRes.toFixed(2) + "%"
          ));
          console.log(chalkBlue(MODULE_ID_PREFIX + " | BETTER CHILD SEED:   " + messageObj.isBetterChildSeed));
        }
        else {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | SEED:                ----"));
        }

        resultsHashmap[messageObj.testRunId] = {};

        networkCreateObj = {};
        networkCreateObj.childId = childId;
        networkCreateObj.status = "EVOLVE";
        networkCreateObj.successRate = 0;
        networkCreateObj.matchRate = 0;
        networkCreateObj.overallMatchRate = 0;
        networkCreateObj.networkId = messageObj.testRunId;
        networkCreateObj.networkTechnology = messageObj.networkTechnology;
        networkCreateObj.hiddenLayerSize = messageObj.hiddenLayerSize;
        networkCreateObj.betterChild = false;
        networkCreateObj.seedNetworkId = messageObj.seedNetworkId;
        networkCreateObj.seedNetworkRes = messageObj.seedNetworkRes;
        networkCreateObj.numInputs = messageObj.inputsObj.meta.numInputs;
        networkCreateObj.inputsId = messageObj.inputsId;
        networkCreateObj.evolve = {};
        networkCreateObj.evolve.startTime = moment().valueOf();
        networkCreateObj.evolve.endTime = moment().valueOf();
        networkCreateObj.evolve.complete = false;
        networkCreateObj.evolve.options = {};
        networkCreateObj.evolve.options = pick(childConf, ["activation", "clear", "cost", "growth", "equal", "mutationRate", "efficientMutation", "popsize", "elitism"]);

        resultsHashmap[messageObj.testRunId] = networkCreateObj;

        await printResultsHashmap();
        await childSend({command: messageObj});
        return;

      default:
        console.log(chalkError(MODULE_ID_PREFIX + " | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode));
        throw new Error("UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode);
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | INIT CREATE NETWORK ERROR: " + err));
    throw err;
  }

}

//=========================================================================
//=========================================================================
//const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

process.title = MODULE_ID.toLowerCase() + "_" + process.pid;

process.on("exit", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS EXIT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

process.on("close", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS CLOSE"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

process.on("SIGHUP", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGHUP"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGHUP"});
});

process.on( "SIGINT", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGINT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGINT"});
});

process.on("unhandledRejection", function(err, promise) {
  console.trace(MODULE_ID_PREFIX + " | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  quit({cause: "unhandledRejection"});
  process.exit(1);
});


//=========================================================================
// CONFIGURATION
//=========================================================================

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

configuration.slackChannel = {};

async function initWatchAllConfigFolders(p){

  const params = p || {};

  console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH ALL CONFIG FILES\n" + jsonPrint(params)));

  try{

    await loadAllConfigFiles();
    await loadNetworkInputsConfig({file: defaultBestInputsConfigFile});
    await loadNetworkInputsConfig({file: defaultNetworkInputsConfigFile});
    await loadNetworkInputsConfig({file: defaultUnionInputsConfigFile});
    await loadCommandLineArgs();

    const options = {
      ignoreDotFiles: true,
      ignoreUnreadableDir: true,
      ignoreNotPermitted: true,
    }

    //========================
    // WATCH NETWORKS
    //========================

    watch.createMonitor(DROPBOX_ROOT_FOLDER + globalBestNetworkFolder, options, function (monitorNetworks) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH GLOBAL NETWORKS FOLDER: " + DROPBOX_ROOT_FOLDER + globalBestNetworkFolder));

      monitorNetworks.on("created", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (!fileNameArray.includes("archive") && file.endsWith(".json") && !file.startsWith("bestRuntimeNetwork")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ NETWORK FILE CREATED: " + f));
          await delay({period: 30*ONE_SECOND});
          try{
            await loadNetworkDropboxFile({folder: globalBestNetworkFolder, file: file});
          }
          catch(err){
            console.log(chalkBlue(MODULE_ID_PREFIX + " | *** LOAD NETWORK FILE CREATED ERROR | " + f + ": " + err));
          }
        }

      });

      monitorNetworks.on("changed", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (!fileNameArray.includes("archive") && file.endsWith(".json") && !file.startsWith("bestRuntimeNetwork")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | -/- NETWORK FILE CHANGED: " + f));
          await delay({period: 30*ONE_SECOND});
          try{
            await loadNetworkDropboxFile({folder: globalBestNetworkFolder, file: file});
          }
          catch(err){
            console.log(chalkBlue(MODULE_ID_PREFIX + " | *** LOAD NETWORK FILE CREATED ERROR | " + f + ": " + err));
          }
        }
      });


      monitorNetworks.on("removed", function (f) {
        const fileNameArray = f.split("/");
        const networkId = fileNameArray[fileNameArray.length-1].replace(".json", "");
        console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX NETWORK FILE DELETED | " + getTimeStamp() 
          + " | " + networkId 
          + "\n" + f
        ));
        networkIdSet.delete(networkId);
      });
    });

    //========================
    // WATCH INPUTS
    //========================

    watch.createMonitor(DROPBOX_ROOT_FOLDER + defaultInputsFolder, options, function (monitorInputs) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH INPUTS CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + defaultInputsFolder));

      monitorInputs.on("created", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (file.startsWith("inputs_")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ INPUTS FILE CREATED: " + f));
          await delay({period: 30*ONE_SECOND});
          try{
            await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
          }
          catch(err){
            console.log(chalkBlue(MODULE_ID_PREFIX + " | *** LOAD INPUTS FILE CREATED ERROR | " + f + ": " + err));
          }
        }

      });

      monitorInputs.on("changed", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (file.startsWith("inputs_")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | -/- INPUTS FILE CHANGED: " + f));
          await delay({period: 30*ONE_SECOND});
          try{
            await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
          }
          catch(err){
            console.log(chalkBlue(MODULE_ID_PREFIX + " | *** LOAD INPUTS FILE CHANGED ERROR | " + f + ": " + err));
          }
        }
      });


      monitorInputs.on("removed", function (f) {
        const fileNameArray = f.split("/");
        const inputsId = fileNameArray[fileNameArray.length-1].replace(".json", "");
        console.log(chalkLog(MODULE_ID_PREFIX + " | XXX INPUTS FILE DELETED | " + getTimeStamp() 
          + " | " + inputsId 
          + " | " + f
        ));
        inputsSet.delete(inputsId);
      });
    });

    //========================
    // WATCH DEFAULT CONFIG
    //========================

    watch.createMonitor(DROPBOX_ROOT_FOLDER + dropboxConfigDefaultFolder, options, function (monitorDefaultConfig) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH DEFAULT CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + dropboxConfigDefaultFolder));

      monitorDefaultConfig.on("created", async function(f){
        if (f.endsWith(dropboxConfigDefaultFile)){
          await delay({period: 30*ONE_SECOND});
          await loadAllConfigFiles();
          await loadCommandLineArgs();
        }

        if (f.endsWith(defaultBestInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultBestInputsConfigFile});
        }

        if (f.endsWith(defaultNetworkInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultNetworkInputsConfigFile});
        }

        if (f.endsWith(defaultUnionInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultUnionInputsConfigFile});
        }

      });

      monitorDefaultConfig.on("changed", async function(f){

        if (f.endsWith(dropboxConfigDefaultFile)){
          await delay({period: 30*ONE_SECOND});
          await loadAllConfigFiles();
          await loadCommandLineArgs();
        }

        if (f.endsWith(defaultBestInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultBestInputsConfigFile});
        }

        if (f.endsWith(defaultNetworkInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultNetworkInputsConfigFile});
        }

        if (f.endsWith(defaultUnionInputsConfigFile)){
          await delay({period: 30*ONE_SECOND});
          await loadNetworkInputsConfig({file: defaultUnionInputsConfigFile});
        }

      });

      monitorDefaultConfig.on("removed", function (f) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
      });
    });

    //========================
    // WATCH HOST CONFIG
    //========================

    watch.createMonitor(DROPBOX_ROOT_FOLDER + dropboxConfigHostFolder, options, function (monitorHostConfig) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH HOST CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + dropboxConfigHostFolder));

      monitorHostConfig.on("created", async function(f){
        if (f.endsWith(dropboxConfigHostFile)){
          await loadAllConfigFiles();
          await loadCommandLineArgs();
        }
      });

      monitorHostConfig.on("changed", async function(f){
        if (f.endsWith(dropboxConfigHostFile)){
          await loadAllConfigFiles();
          await loadCommandLineArgs();
        }
      });

      monitorHostConfig.on("removed", function (f) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
      });
    });

    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX
      + " | *** INIT LOAD ALL CONFIG INTERVAL ERROR: " + err
    ));
    throw err;
  }
}

async function initConfig(cnf) {

  statsObj.status = "INIT CONFIG";

  console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

  if (debug.enabled) {
    console.log("\nTNN | %%%%%%%%%%%%%%\nTNN |  DEBUG ENABLED \nTNN | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
  cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
  cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
  cnf.enableStdin = process.env.ENABLE_STDIN || true;

  if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
  else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
    cnf.quitOnComplete = true;
  }

  try {

    await initWatchAllConfigFolders();

    const configArgs = Object.keys(configuration);

    configArgs.forEach(function(arg){
      if (_.isObject(configuration[arg])) {
        console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
      }
      else {
        console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
      }
    });
    
    statsObj.commandLineArgsLoaded = true;

    if (configuration.enableStdin) { initStdIn(); }

    await initStatsUpdate();

    return configuration;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
    throw err;
  }

}


//=========================================================================
// MONGO DB
//=========================================================================

global.globalDbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

const emojiModel = require("@threeceelabs/mongoose-twitter/models/emoji.server.model");
const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
const locationModel = require("@threeceelabs/mongoose-twitter/models/location.server.model");
const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");
const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

global.globalWordAssoDb = require("@threeceelabs/mongoose-twitter");

const UserServerController = require("@threeceelabs/user-server-controller");
let userServerController;
let userServerControllerReady = false;

function connectDb(){

  return new Promise(function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

      global.globalWordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          db.close();
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
          quit({cause: "MONGO DB DISCONNECTED"});
        });


        global.globalDbConnection = db;

        console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        global.globalEmoji = global.globalDbConnection.model("Emoji", emojiModel.EmojiSchema);
        global.globalHashtag = global.globalDbConnection.model("Hashtag", hashtagModel.HashtagSchema);
        global.globalLocation = global.globalDbConnection.model("Location", locationModel.LocationSchema);
        global.globalMedia = global.globalDbConnection.model("Media", mediaModel.MediaSchema);
        global.globalNeuralNetwork = global.globalDbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
        global.globalNetworkInputs = global.globalDbConnection.model("NetworkInputs", networkInputsModel.NetworkInputsSchema);
        global.globalPlace = global.globalDbConnection.model("Place", placeModel.PlaceSchema);
        global.globalTweet = global.globalDbConnection.model("Tweet", tweetModel.TweetSchema);
        global.globalUrl = global.globalDbConnection.model("Url", urlModel.UrlSchema);
        global.globalUser = global.globalDbConnection.model("User", userModel.UserSchema);
        global.globalWord = global.globalDbConnection.model("Word", wordModel.WordSchema);

        const uscChildName = MODULE_ID_PREFIX + "_USC";
        userServerController = new UserServerController(uscChildName);

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
        });

        const dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady) {

            console.log(chalkGreen(MODULE_ID_PREFIX + " | MONGO DB READY"));

            clearInterval(dbConnectionReadyInterval);
            statsObj.status = "MONGO DB CONNECTED";
            resolve(db);
          }

        }, 1000);

      });
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
      reject(err);
    }
  });
}

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================
function jsonPrint(obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
}

function msToTime(d) {

  let duration = d;
  let sign = 1;

  if (duration < 0) {
    sign = -1;
    duration = -duration;
  }

  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));
  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  if (sign > 0) return days + ":" + hours + ":" + minutes + ":" + seconds;
  return "- " + days + ":" + hours + ":" + minutes + ":" + seconds;
}

function getTimeStamp(inputTime) {
  let currentTimeStamp;
  if (inputTime === undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function delay(p) {

  const params = p || {};
  const period = params.period || 10*ONE_SECOND;
  const verbose = params.verbose || false;

  return new Promise(function(resolve, reject){

    try {
      if (verbose) {
        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ DELAY START | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
      }

      setTimeout(function(){
        if (verbose) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | XXX DELAY END | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
        }
        resolve();
      }, period);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** delay ERROR:", err));
      reject(err);
    }

  });
}

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function touchChildPidFile(params){

  return new Promise(function(resolve, reject){

    try{

      const childPidFile = params.childId + "=" + params.pid;

      const folder = params.folder || childPidFolderLocal;

      shell.mkdir("-p", folder);

      const path = folder + "/" + childPidFile;

      touch.sync(path, { force: true });

      console.log(chalkBlue(MODULE_ID_PREFIX + " | TOUCH CHILD PID FILE: " + path));
      resolve(path);
    }
    catch(err){
      return reject(err);
    }

  });
}

function getChildProcesses(){

  return new Promise(function(resolve, reject){

    const childPidArray = [];

    shell.mkdir("-p", childPidFolderLocal);

    console.log("SHELL: cd " + childPidFolderLocal);
    shell.cd(childPidFolderLocal);

    const childPidFileNameArray = shell.ls(configuration.childIdPrefix + "*");

    async.eachSeries(childPidFileNameArray, function (childPidFileName, cb) {

      console.log("SHELL: childPidFileName: " + childPidFileName);

      const childPidStringArray = childPidFileName.split("=");

      const childId = childPidStringArray[0];
      const childPid = parseInt(childPidStringArray[1]);

      console.log("SHELL: CHILD ID: " + childId + " | PID: " + childPid);

      if (childHashMap[childId]) {
        debug("CHILD HM HIT"
          + " | ID: " + childId 
          + " | SHELL PID: " + childPid 
          + " | HM PID: " + childHashMap[childId].pid 
          + " | STATUS: " + childHashMap[childId].status
        );
      }
      else {
        console.log("CHILD HM MISS | ID: " + childId + " | PID: " + childPid + " | STATUS: UNKNOWN");
      }

      if ((childHashMap[childId] !== undefined) && (childHashMap[childId].pid === childPid)) {

        childPidArray.push({ pid: childPid, childId: childId});

        console.log(chalkInfo(MODULE_ID_PREFIX + " | FOUND CHILD"
          + " [ " + childPidArray.length + " CHILDREN ]"
          + " | ID: " + childId
          + " | PID: " + childPid
          + " | FILE: " + childPidFileName
        ));

        cb();

      }
      else {

        console.log("SHELL: CHILD NOT IN HASH | ID: " + childId + " | PID: " + childPid);

        if (childHashMap[childId] === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD NOT IN HM"
            + " | " + childId
          ));
        }

        if (childHashMap[childId] && childHashMap[childId].pid === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PID HM MISMATCH"
            + " | " + childId
            + " | HM PID: " + childHashMap[childId].pid
            + " | PID: " + childPid
          ));
        }

        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD ZOMBIE"
          + " | " + childId
          + " | TERMINATING ..."
        ));

        kill(childPid, function(err){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL ZOMBIE ERROR: ", err));
            return cb(err);
          }

          shell.cd(childPidFolderLocal);
          shell.rm(childId + "*");

          delete childHashMap[childId];

          console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD ZOMBIE"
            + " [ " + childPidArray.length + " CHILDREN ]"
            + " | ID: " + childId
            + " | PID: " + childPid
          ));

          cb();

        });

      }

    }, function(err){
      if (err) {
        return reject(err);
      }

      resolve(childPidArray);

    });

  });
}

function killChild(params){

  return new Promise(function(resolve, reject){

    let pid;

    if ((params.pid === undefined) && childHashMap[params.childId] === undefined) {
      return reject(new Error("CHILD ID NOT FOUND: " + params.childId));
    }

    if (params.pid) {
      pid = params.pid;
    }
    else if (params.childId && childHashMap[params.childId] !== undefined) {
      pid = childHashMap[params.childId].pid;
    }


    kill(pid, function(err){

      if (err) { return reject(err); }
      resolve(params);

    });

  });
}

async function killAll(){

  console.log("KILL ALL");

  const childPidArray = await getChildProcesses({searchTerm: configuration.childIdPrefix});

  console.log(chalkAlert("getChildProcesses childPidArray\n" + jsonPrint(childPidArray)));
  if (childPidArray && (childPidArray.length > 0)) {

    async.eachSeries(childPidArray, function(childObj, cb){

      killChild({pid: childObj.pid}).
      then(function(){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL | KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.childId));
        cb();
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL CHILD ERROR"
          + " | PID: " + childObj.pid
          + " | ERROR: " + err
        ));
        return cb(err);
      });

    }, function(err){

      if (err){
        throw err;
      }

      return childPidArray;

    });
  }
  else {

    console.log(chalkBlue(MODULE_ID_PREFIX + " | KILL ALL | NO CHILDREN"));
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
    console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
    return;
  }
  else {

    Object.keys(childHashMap).forEach(function(childId) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | STATUS CHILD"
        + " | CHILD ID: " + childId + " | CH FSM: " + childHashMap[childId].status
      ));

      objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
    });

    console.log(chalkLog(MODULE_ID_PREFIX + " | STATUS"
      + " | FSM: " + fsm.getMachineState()
      + " | START: " + statsObj.startTime
      + " | NOW: " + getTimeStamp()
      + " | ELAPSED: " + statsObj.elapsed
    ));

    return;
  }

}

function initStatsUpdate() {

  return new Promise(function(resolve, reject){

    try {

      console.log(chalkLog(MODULE_ID_PREFIX + " | INIT STATS UPDATE INTERVAL | " + msToTime(configuration.statsUpdateIntervalTime)));

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      saveFile({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

      clearInterval(statsUpdateInterval);

      statsUpdateInterval = setInterval(async function () {

        statsObj.elapsed = getElapsedTimeStamp();
        statsObj.timeStamp = getTimeStamp();

        saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
        statsObj.queues.saveFileQueue.size = saveFileQueue.length;

        try{
          await showStats();
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
        }
        
      }, configuration.statsUpdateIntervalTime);

      resolve();

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** initStatsUpdate ERROR:", err));
      reject(err);
    }
  });
}

// ==================================================================
// DROPBOX
// ==================================================================
const Dropbox = require("dropbox").Dropbox;

const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json"
const defaultUnionInputsConfigFile = "default_unionInputsConfig.json";

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const childPidFolderLocal = (hostname === "google") 
  ? DROPBOX_ROOT_FOLDER + "/config/utility/google/children" 
  : DROPBOX_ROOT_FOLDER + "/config/utility/" + hostname + "/children";

const statsFolder = "/stats/" + hostname;
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const globalArchiveInputsFolder = "/config/utility/default/inputsArchive";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
const localFailNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/fail";
const localArchiveNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/archive";

const dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

const dropboxLocalClient = { // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

let dropboxClient;

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}


function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        reject(err);
      }
      else {

        const itemArray = [];

        async.each(items, function(item, cb){

          itemArray.push(
            {
              name: item, 
              client_modified: false,
              content_hash: false,
              path_display: fullPath + "/" + item
            }
          );
          cb();

        }, function(err){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** filesListFolderLocal ERROR:", err));
            return reject(err);
          }
          const response = {
            cursor: false,
            has_more: false,
            entries: itemArray
          };

          resolve(response);
        });
        }
    });
  });
}

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

    fs.stat(fullPath, function(err, stats){
      if (err) {
        reject(err);
      }
      else {
        const response = {
          client_modified: stats.mtimeMs
        };
        
        resolve(response);
      }
    });
  });
}

function loadFile(params) {

  return new Promise(function(resolve, reject){

    const noErrorNotFound = params.noErrorNotFound || false;

    let fullPath = params.path || params.folder + "/" + params.file;

    debug(chalkInfo("LOAD PATH " + params.path));
    debug(chalkInfo("LOAD FOLDER " + params.folder));
    debug(chalkInfo("LOAD FILE " + params.file));
    debug(chalkInfo("FULL PATH " + fullPath));


    if (configuration.offlineMode || params.loadLocalFile) {

      fullPath = DROPBOX_ROOT_FOLDER + fullPath;
      console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));

      fs.readFile(fullPath, "utf8", function(err, data) {

        if (err) {
          console.log(chalkError("fs readFile ERROR: " + err));
          return reject(err);
        }

        console.log(chalkInfo(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX"
          + " | " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          JSONParse(data, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            const fileObjSizeMbytes = sizeof(fileObj)/ONE_MEGABYTE;

            console.log(chalkInfo(getTimeStamp()
              + " | LOADED FILE FROM DROPBOX"
              + " | " + fileObjSizeMbytes.toFixed(2) + " MB"
              + " | " + fullPath
            ));

            return resolve(fileObj);

          });

        }

        console.log(chalkError(getTimeStamp()
          + " | ... SKIP LOAD FILE FROM DROPBOX"
          + " | " + fullPath
        ));
        resolve();

      });

     }
    else {

      dropboxClient.filesDownload({path: fullPath}).
      then(function(data) {

        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          const payload = data.fileBinary;

          if (!payload || (payload === undefined)) {
            return reject(new Error(MODULE_ID_PREFIX + " LOAD FILE PAYLOAD UNDEFINED"));
          }

          JSONParse(payload, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            if (params.includeMetaData) {

              const results = {};

              results.data = fileObj;

              results.meta = {};
              delete data.fileBinary;
              results.meta = data;

              return resolve(results);

            }
            return resolve(fileObj);

          });

        }
        else {
          resolve();
        }
      }).
      catch(function(err) {

        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
        
        if ((err.status === 409) || (err.status === 404)) {
          if (noErrorNotFound) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
            return resolve(new Error("NOT FOUND"));
          }
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND ... SKIPPING ..."));
          return resolve(err);
        }
        
        if (err.status === 0) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"
            + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
          return resolve(new Error("NO INTERNET"));
        }

        reject(err);

      });
    }
  });
}

async function loadFileRetry(params){

  const resolveOnNotFound = params.resolveOnNotFound || false;
  const maxRetries = params.maxRetries || 10;
  let retryNumber;
  let backOffTime = params.initialBackOffTime || ONE_SECOND;
  const path = params.path || params.folder + "/" + params.file;

  for (retryNumber = 0;retryNumber < maxRetries;retryNumber++) {
    try {
      
      const fileObj = await loadFile(params);

      if (retryNumber >= maxRetries) { 
        console.log(chalkError(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
          + " | " + path
          + " | BACKOFF: " + msToTime(backOffTime)
          + " | " + retryNumber + " OF " + maxRetries
        ));
        throw new Error("FILE LOAD ERROR | RETRIES " + maxRetries);
      }

      if (retryNumber > 0) { 
        console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
          + " | " + path
          + " | BACKOFF: " + msToTime(backOffTime)
          + " | " + retryNumber + " OF " + maxRetries
        )); 
      }

      return fileObj;
    } 
    catch(err) {
      backOffTime *= 2;
      setTimeout(function(){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD ERROR ... RETRY"
          + " | " + path
          + " | BACKOFF: " + msToTime(backOffTime)
          + " | " + retryNumber + " OF " + maxRetries
          + " | ERROR: " + err
        )); 
      }, backOffTime);
    }
  }

  if (resolveOnNotFound) {
    console.log(chalkAlert(MODULE_ID_PREFIX + " | resolve FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
    return false;
  }
  console.log(chalkError(MODULE_ID_PREFIX + " | reject FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
  throw new Error("FILE LOAD ERROR | RETRIES " + maxRetries);
}

function getFileMetadata(params) {

  return new Promise(function(resolve, reject){

    const fullPath = params.folder + "/" + params.file;

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    dropboxClient.filesGetMetadata({path: fullPath}).
    then(function(response) {
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      resolve(response);
    }).
    catch(function(err) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR: " + fullPath));

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR | " + fullPath + " NOT FOUND"));
      }
      else if (err.status === 0) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata NO RESPONSE"));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR: " + err));
      }

      reject(err);

    });

  });
}

function listDropboxFolder(params){

  return new Promise(function(resolve, reject){

    try{

      statsObj.status = "LIST DROPBOX FOLDER: " + params.folder;

      const results = {};
      results.entries = [];

      let cursor;
      let more = false;
      const limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

      console.log(chalkNetwork(MODULE_ID_PREFIX
        + " | LISTING DROPBOX FOLDER"
        + " | LIMIT: " + limit
        + " | " + params.folder
      ));

      dropboxClient.filesListFolder({path: params.folder, limit: limit}).
      then(function(response){

        cursor = response.cursor;
        more = response.has_more;
        results.entries = response.entries;

        if (configuration.verbose) {
          console.log(chalkLog("DROPBOX LIST FOLDER"
            + " | FOLDER:" + params.folder
            + " | ENTRIES: " + response.entries.length
            + " | LIMIT: " + limit
            + " | MORE: " + more
          ));
        }

        async.whilst(

          function test(cbTest) { cbTest(null, more); },

          function(cb){
            setTimeout(function(){

              dropboxClient.filesListFolderContinue({cursor: cursor}).
              then(function(responseCont){

                cursor = responseCont.cursor;
                more = responseCont.has_more;
                results.entries = results.entries.concat(responseCont.entries);

                if (configuration.verbose) {
                  console.log(chalkLog("DROPBOX LIST FOLDER CONT"
                    + " | PATH:" + params.folder
                    + " | ENTRIES: " + responseCont.entries.length + "/" + results.entries.length
                    + " | LIMIT: " + limit
                    + " | MORE: " + more
                  ));
                }

              }).
              catch(function(err){
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", err));
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", jsonPrint(err.tag)));
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", err.tag));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });
            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }
            resolve(results);
          }
        );
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
      return reject(err);
    }

  });
}

async function loadConfigFile(params) {

  const fullPath = params.folder + "/" + params.file;

  try {

    if (params.file === dropboxConfigDefaultFile) {
      prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
    }
    else {
      prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
    }

    if (configuration.offlineMode) {
      await loadCommandLineArgs();
      return;
    }

    try {

      const response = await getFileMetadata({folder: params.folder, file: params.file});

      const fileModifiedMoment = moment(new Date(response.client_modified));
      
      if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

        console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG FILE BEFORE OR EQUAL"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));
        return;
      }

      console.log(chalkLog(MODULE_ID_PREFIX + " | +++ CONFIG FILE AFTER ... LOADING"
        + " | " + fullPath
        + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
        + " | " + fileModifiedMoment.format(compactDateTimeFormat)
      ));

      prevConfigFileModifiedMoment = moment(fileModifiedMoment);

      if (params.file === dropboxConfigDefaultFile) {
        prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
      }
      else {
        prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
      }

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD CONFIG FILE ERROR: " + err));
      throw err;
    }


    const loadedConfigObj = await loadFile({folder: params.folder, file: params.file, noErrorNotFound: true });

    if (loadedConfigObj === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
      throw new Error("JSON UNDEFINED");
    }

    if (loadedConfigObj instanceof Error) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj));
    }

    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

    const newConfiguration = {};
    newConfiguration.evolve = {};

    if (loadedConfigObj.TNN_NETWORK_TECHNOLOGY !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_NETWORK_TECHNOLOGY: " + loadedConfigObj.TNN_NETWORK_TECHNOLOGY);
      newConfiguration.networkTechnology = loadedConfigObj.TNN_NETWORK_TECHNOLOGY;
    }

    if (loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY: " + loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY);
      if ((loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === true) || (loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === "true")) {
        newConfiguration.enableRandomTechnology = true;
      }
      if ((loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === false) || (loadedConfigObj.TNN_ENABLE_RANDOM_NETWORK_TECHNOLOGY === "false")) {
        newConfiguration.enableRandomTechnology = false;
      }
    }

    if (loadedConfigObj.TEST_MODE !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TEST_MODE: " + loadedConfigObj.TEST_MODE);
      if ((loadedConfigObj.TEST_MODE === true) || (loadedConfigObj.TEST_MODE === "true")) {
        newConfiguration.testMode = true;
      }
      if ((loadedConfigObj.TEST_MODE === false) || (loadedConfigObj.TEST_MODE === "false")) {
        newConfiguration.testMode = false;
      }
    }

    if (loadedConfigObj.QUIT_ON_COMPLETE !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED QUIT_ON_COMPLETE: " + loadedConfigObj.QUIT_ON_COMPLETE);
      if ((loadedConfigObj.QUIT_ON_COMPLETE === true) || (loadedConfigObj.QUIT_ON_COMPLETE === "true")) {
        newConfiguration.quitOnComplete = true;
      }
      if ((loadedConfigObj.QUIT_ON_COMPLETE === false) || (loadedConfigObj.QUIT_ON_COMPLETE === "false")) {
        newConfiguration.quitOnComplete = false;
      }
    }

    if (loadedConfigObj.TNN_PURGE_MIN !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_PURGE_MIN: " + loadedConfigObj.TNN_PURGE_MIN);
      if ((loadedConfigObj.TNN_PURGE_MIN === true) || (loadedConfigObj.TNN_PURGE_MIN === "true")) {
        newConfiguration.purgeMin = true;
      }
      if ((loadedConfigObj.TNN_PURGE_MIN === false) || (loadedConfigObj.TNN_PURGE_MIN === "false")) {
        newConfiguration.purgeMin = false;
      }
    }

    if (loadedConfigObj.VERBOSE !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
      if ((loadedConfigObj.VERBOSE === true) || (loadedConfigObj.VERBOSE === "true")) {
        newConfiguration.verbose = true;
      }
      if ((loadedConfigObj.VERBOSE === false) || (loadedConfigObj.VERBOSE === "false")) {
        newConfiguration.verbose = false;
      }
    }

    if (loadedConfigObj.ENABLE_STDIN !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED ENABLE_STDIN: " + loadedConfigObj.ENABLE_STDIN);
      newConfiguration.enableStdin = loadedConfigObj.ENABLE_STDIN;
    }

    if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
      newConfiguration.maxNumberChildren = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
    }

    if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_SEED_NETWORK_PROBABILITY: " + loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY);
      newConfiguration.seedNetworkProbability = loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
    }

    if (loadedConfigObj.TNN_EVOLVE_COST_ARRAY !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_COST_ARRAY: " + loadedConfigObj.TNN_EVOLVE_COST_ARRAY);
      newConfiguration.costArray = loadedConfigObj.TNN_EVOLVE_COST_ARRAY;
    }

    if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
      newConfiguration.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
      newConfiguration.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE_MSE !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_LOCAL_MIN_SUCCESS_RATE_MSE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE_MSE);
      newConfiguration.localMinSuccessRateMSE = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE_MSE;
    }

    if (loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_LOCAL_PURGE_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE);
      newConfiguration.localPurgeMinSuccessRate = loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_THREADS: " + loadedConfigObj.TNN_EVOLVE_THREADS);
      newConfiguration.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
    }

    if (loadedConfigObj.TNN_INPUTS_IDS !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS);
      newConfiguration.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
    }

    if (loadedConfigObj.TNN_EVOLVE_ITERATIONS !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
      if (newConfiguration.evolve === undefined) { newConfiguration.evolve = {}; }
      newConfiguration.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
    }

    return newConfiguration;
  }
  catch(err){
    console.error(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD DROPBOX CONFIG: " + fullPath
      + "\n" + jsonPrint(err)
    ));
    throw err;
  }

}

async function loadAllConfigFiles(){

  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({folder: dropboxConfigDefaultFolder, file: dropboxConfigDefaultFile});

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
  }
  
  const hostConfig = await loadConfigFile({folder: dropboxConfigHostFolder, file: dropboxConfigHostFile});

  if (hostConfig) {
    hostConfiguration = hostConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
  }
  
  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

  configuration = deepcopy(tempConfig);

  configuration.costArray = _.uniq(configuration.costArray);

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


let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS");

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod
});

function saveCacheExpired(file, fileObj) {
  debug(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));
  saveFileQueue.push(fileObj);
  statsObj.queues.saveFileQueue.size = saveFileQueue.length;
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog(MODULE_ID_PREFIX + " | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
});

function saveFile(params, callback){

  const fullPath = params.folder + "/" + params.file;
  const limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;
  const localFlag = params.localFlag || false;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  const options = {};

  if (localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats().then(function(){

    }).
    catch(function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR:", err));
    });

    console.log(chalkBlue(MODULE_ID_PREFIX + " | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 }).
    then(function() {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    }).
    catch(function(error){
      console.trace(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX LOCAL JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
      ));
      if (callback !== undefined) { return callback(error); }
    });
  }
  else {

    options.contents = JSON.stringify(params.obj, null, 2);
    options.autorename = params.autorename || false;
    options.mode = params.mode || "overwrite";
    options.path = fullPath;

    const dbFileUpload = function () {

      dropboxClient.filesUpload(options).
      then(function(){
        debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
        if (callback !== undefined) { return callback(null); }
      }).
      catch(function(error){
        if (error.status === 413){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + "\n" + MODULE_ID_PREFIX + " | ERROR:        " + error
            + "\n" + MODULE_ID_PREFIX + " | ERROR CODE:   " + error.code
            + "\n" + MODULE_ID_PREFIX + " | ERROR STATUS: " + error.status
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: limit}).
      then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkLog(MODULE_ID_PREFIX + " | DROPBOX FILE"
            + " | " + params.folder
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
          ));

          if (entry.name === params.file) {
            fileExits = true;
          }

          cb();

        }, function(err){
          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT DROPBOX SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
          statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        }
        else {
          console.log(chalkLog(MODULE_ID_PREFIX + " | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        statsObj.queues.saveFileQueue.busy = false;
      });

    }
  }, cnf.saveFileQueueInterval);
}


//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals(){
  return new Promise(function(resolve, reject){
    try {
      [...intervalsSet].forEach(function(intervalHandle){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | CLEAR INTERVAL | " + intervalHandle));
        clearInterval(intervalHandle);
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

// let quitWaitInterval;
let quitFlag = false;

function readyToQuit() {
  const flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  if (quitFlag) {
    console.log(chalkInfo(MODULE_ID_PREFIX + " | ALREADY IN QUIT"));
    if (opts) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | REDUNDANT QUIT INFO\n" + jsonPrint(opts) ));
    }
    return;
  }

  quitFlag = true;

  const options = opts || false;

  let slackText = "QUIT";
  if (options) {
    slackText += " | " + options.cause;
  }

  slackSendWebMessage({channel: slackChannel, text: slackText});

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  fsm.fsm_quit();

  try{
    await childQuitAll();

    await killAll();

    await showStats(true);
  }
  catch(err){
    console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
  }


  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  setInterval(async function() {

    if (readyToQuit()) {

      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE ... QUITTING"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      const command = 'pkill ' + configuration.childIdPrefix + '*';

      shell.exec(command, function(code, stdout, stderr){

        console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL CHILD"
          + "\nCOMMAND: " + command
          + "\nCODE:    " + code
          + "\nSTDOUT:  " + stdout
          + "\nSTDERR:  " + stderr
        ));

        shell.cd(childPidFolderLocal);
        shell.rm(configuration.childIdPrefix + "*");
      });

      if (!global.dbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          global.dbConnection.close(async function () {
            console.log(chalkBlue(
                MODULE_ID_PREFIX + " | ==========================\n"
              + MODULE_ID_PREFIX + " | MONGO DB CONNECTION CLOSED\n"
              + MODULE_ID_PREFIX + " | ==========================\n"
            ));

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

const cla = require("command-line-args");

const help = { name: "help", alias: "h", type: Boolean};

const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean};

const threads = { name: "threads", alias: "t", type: Number};
const maxNumberChildren = { name: "maxNumberChildren", alias: "N", type: Number};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadAllInputs = { name: "loadAllInputs", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "F", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  threads,
  maxNumberChildren,
  useLocalTrainingSets,
  loadAllInputs,
  loadTrainingSetFromFile,
  inputsId,
  trainingSetFile,
  networkCreateMode,
  hiddenLayerSize,
  seedNetworkId,
  useBestNetwork, 
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  verbose, 
  evolveIterations, 
  testMode,
  help
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo(MODULE_ID_PREFIX + " | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));


if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

if (Object.keys(commandLineConfig).includes("help")) {
  console.log(MODULE_ID_PREFIX + " |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit({cause: "help"});
}

statsObj.commandLineConfig = commandLineConfig;


function loadCommandLineArgs(){

  return new Promise(function(resolve){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      if (arg === "threads"){
        configuration.evolve.threads = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }
      else if (arg === "evolveIterations"){
        configuration.evolve.iterations = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }
      else {
        configuration[arg] = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
      }

      cb();

    }, function(){
      statsObj.commandLineArgsLoaded = true;
      resolve();
    });

  });
}

async function loadNetworkInputsConfig(params){

  statsObj.status = "LOAD NETWORK INPUTS CONFIG";

  console.log(chalkLog(MODULE_ID_PREFIX
    + " | LOAD NETWORK INPUTS CONFIG FILE: " + dropboxConfigDefaultFolder + "/" + params.file
  ));

  let networkInputsObj;

  try {

    networkInputsObj = await loadFileRetry({folder: dropboxConfigDefaultFolder, file: params.file});

    configuration.inputsIdArray = _.union(configuration.inputsIdArray, networkInputsObj.INPUTS_IDS);

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | LOADED NETWORK INPUTS ARRAY"
      + " | " + networkInputsObj.INPUTS_IDS.length + " ITEMS IN FILE"
      + " | " + configuration.inputsIdArray.length + " TOTAL ITEMS IN ARRAY"
    ));

    statsObj.networkInputsSetReady = true;
    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS CONFIG FILE LOAD ERROR: " + err));
    statsObj.networkInputsSetReady = false;
    throw err;
  }

}

function initChildPingAllInterval(params){

  const interval = (params) ? params.interval : configuration.childPingAllInterval;

  return new Promise(function(resolve){

    statsObj.status = "INIT CHILD PING ALL INTERVAL";

    clearInterval(childPingAllInterval);

    childPingAllInterval = setInterval(async function(){

      try{
        await childPingAll();
      }
      catch(err){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PING ALL ERROR: " + err));
      }

    }, interval);

    intervalsSet.add("childPingAllInterval");

    resolve();

  });
}

//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");
const FSM_TICK_INTERVAL = ONE_SECOND;

let fsmTickInterval;
let fsmPreviousState = "RESET";
let createChildrenInProgress = false;
let killAllInProgress = false;

statsObj.fsmState = "RESET";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> MAIN"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTNN | --------------------------------------------------------"
  ));
}

const fsmStates = {

  "RESET": {

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        console.log(chalkTwitter(MODULE_ID_PREFIX + " | FSM RESET"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try{
          await childQuitAll();
          await killAll();
          await showStats(true);
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
        }
      }

    },

    fsm_tick: function() {

      if (getChildProcesses() > 0) {

        if (!killAllInProgress) {

          killAllInProgress = true;

          killAll().
            then(function(){
              killAllInProgress = false;
            }).
            catch(function(err){
              killAllInProgress = false;
              console.log(chalkError(MODULE_ID_PREFIX + " | KILL ALL CHILD ERROR: " + err));
            });
        }
      }
      else {
        checkChildState({checkState: "RESET", noChildrenTrue: true}).then(function(allChildrenReset){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN RESET: " + allChildrenReset));
          if (!killAllInProgress && allChildrenReset) { fsm.fsm_resetEnd(); }
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN RESET ERROR: " + err));
          fsm.fsm_error();
        });
      }
    },

    "fsm_resetEnd": "IDLE"
  },

  "IDLE": {
    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM IDLE";

        checkChildState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN IDLE: " + allChildrenIdle));
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
          fsm.fsm_error();
        });
      }

    },

    fsm_tick: function() {

      checkChildState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
        debug("INIT TICK | ALL CHILDREN IDLE: " + allChildrenIdle );
        if (allChildrenIdle) { fsm.fsm_init(); }
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_quit": "QUIT",
    "fsm_error": "ERROR"
  },

  "QUIT": {
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM QUIT";

      quit({cause: "FSM QUIT"});
    }
  },

  "EXIT": {
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM EXIT";

      quit({cause: "FSM EXIT"});
    }
  },

  "ERROR": {
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM ERROR";

      quit({cause: "FSM ERROR"});
    }
  },

  "INIT": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        try {
          await childCreateAll();
          console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },
    fsm_tick: function() {

      checkChildState({checkState: "READY", noChildrenTrue: false}).then(function(allChildrenReady){

        debug("READY INIT"
          + " | ALL CHILDREN READY: " + allChildrenReady
        );

        if (maxChildren() && allChildrenReady) { fsm.fsm_ready(); }

      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY": {
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM READY";

        checkChildState({checkState: "READY", noChildrenTrue: false}).then(function(allChildrenReady){
          console.log(MODULE_ID_PREFIX + " | ALL CHILDREN READY: " + allChildrenReady);
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
          fsm.fsm_error();
        });

      }
    },
    fsm_tick: function() {

      checkChildState({checkState: "READY", noChildrenTrue: false}).
      then(function(allChildrenReady){

        debug("READY TICK"
          + " | ALL CHILDREN READY: " + allChildrenReady
        );

        if (maxChildren() && allChildrenReady) { 
          fsm.fsm_run();
        }

      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_run": "RUN",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },


  "RUN": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM RUN";

        try {

          await initChildPingAllInterval();
          await childStatsAll();

          await loadNetworkInputsConfig({file: defaultBestInputsConfigFile});
          await loadNetworkInputsConfig({file: defaultNetworkInputsConfigFile});
          await loadNetworkInputsConfig({file: defaultUnionInputsConfigFile});
          await loadBestNetworkDropboxFolders({folders: [globalBestNetworkFolder, localBestNetworkFolder]});
          await loadInputsDropboxFolders({folders: [defaultInputsFolder]});

          await childStartAll();

        }
        catch(err){
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** RUN ERROR: " + err));
        }
      }

    },
    fsm_tick: function() {

      if (configuration.quitOnComplete){
        checkChildState({checkState: "COMPLETE"}).then(function(allChildrenComplete){

          debug("FETCH_END TICK"
            + " | ALL CHILDREN COMPLETE: " + allChildrenComplete
          );

          if (allChildrenComplete) { 
            console.log(chalkLog(MODULE_ID_PREFIX + " | ALL CHILDREN COMPLETE"));
            // sentAllChildrenCompleteFlag = false;
            fsm.fsm_complete();
          }

        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN COMPLETE ERROR: " + err));
          fsm.fsm_error();
        });
      }

      else if (!maxChildren()){
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | LESS THAN MAX CHILDREN: " + getNumberOfChildren() 
          + " | MAX: " + configuration.maxNumberChildren
        ));

        if (!createChildrenInProgress){

          createChildrenInProgress = true;

          childCreateAll().
            then(function(childIdArray){
              console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + childIdArray.length));
              childIdArray.forEach(async function(childId){
                await startNetworkCreate({childId: childId, compareTechFlag: true});
              });
              createChildrenInProgress = false;
            }).
            catch(function(err){
              console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
              createChildrenInProgress = false;
              fsm.fsm_error();
            });
        }
      }

    },
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_complete": "COMPLETE"
  },

  "COMPLETE": {

    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM COMPLETE";

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | FSM COMPLETE | QUITTING ..."));

        quit({cause: "FSM_COMPLETE"});
      }

    },

    fsm_tick: function() {

      checkChildState({checkState: "RESET", noChildrenTrue: true}).then(function(allChildrenReset){
        console.log(MODULE_ID_PREFIX + " | RESET TICK"
          + " | ALL CHILDREN RESET: " + allChildrenReset
        );
        if (allChildrenReset) { fsm.fsm_resetEnd(); }
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** checkChildState ERROR:", err));
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_resetEnd": "INIT",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },
};

const fsm = Stately.machine(fsmStates);

function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

//=========================================================================
// CHILD PROCESS
//=========================================================================
configuration.reinitializeChildOnClose = false;

function maxChildren(){
  return getNumberOfChildren() >= configuration.maxNumberChildren;
}

function getNumberOfChildren(){
  if (childHashMap === undefined) {
    throw new Error("childHashMap UNDEFINED");
  }
  return Object.keys(childHashMap).length;
}

function childCreateAll(p){

  return new Promise(function(resolve, reject){

    console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATING ALL CHILDREN"));

    const params = p || {};

    const childrenCreatedArray = [];

    const interval = params.interval || 5*ONE_SECOND;
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
    createParams.args = {};
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

      function(cb){

        setTimeout(function(){

          childId = CHILD_PREFIX + "_" + hostname + "_" + process.pid + "_" + childIndex;
          childIdShort = CHILD_PREFIX_SHORT + "_" + process.pid + "_" + childIndex;

          createParams.childId = childId;
          createParams.childIdShort = childIdShort;
          options.env.CHILD_ID = childId;
          options.env.CHILD_ID_SHORT = childIdShort;

          if (configuration.verbose) { console.log("createParams\n" + jsonPrint(createParams)); }

          childCreate(createParams).
          then(function(){
            childrenCreatedArray.push(childId);
            childIndex += 1;
            configuration.childIndex = childIndex;
            statsObj.childIndex = childIndex;
            cb();
          }).
          catch(function(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CHILD CREATE ERROR: " + err));
            return cb(err);
          });


        }, interval);
      },

      function(err){
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE ALL CHILDREN: " + err));
          return reject(err);
        }
        resolve(childrenCreatedArray);
      });


  });
}

async function childStatsAll(p){

  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "STATS";
  defaultCommand.now = now;

  const command = params.command || defaultCommand;
  await childSendAll({command: command});
}

function getNewNetworkId(p){
  const params = p || {};
  params.prefix = params.prefix || configuration.networkIdPrefix;
  const networkId = params.prefix + "_" + networkIndex;
  networkIndex += 1;
  return networkId;
}

async function startNetworkCreate(params){

    const networkId = getNewNetworkId();

    childHashMap[params.childId].currentNetworkId = networkId;

    console.log(chalkBlue(MODULE_ID_PREFIX + " | START EVOLVE CHILD"
      + " | CHILD: " + params.childId
      + " | NETWORK ID: " + networkId
    ));

    await initNetworkCreate({childId: params.childId, networkId: networkId, compareTechFlag: params.compareTechFlag});

    return;
}

function childStartAll(){

  return new Promise(function(resolve, reject){

      console.log(chalkBlue(MODULE_ID_PREFIX + " | START EVOLVE ALL CHILDREN: " + Object.keys(childHashMap).length));

      async.eachSeries(Object.keys(childHashMap), async function(childId) {

        if (childHashMap[childId] !== undefined){
          try {
            await startNetworkCreate({childId: childId, compareTechFlag: true});
            return;
          }
          catch(err){
            return err;
          }
        }

        return;

      }, function(err){
        if (err) {
          console.log(chalkError("TNN | *** CHILD START ALL ERROR: " + err));
          return reject(err);
        }
        resolve();
      });

  });
}

async function childQuitAll(p){

  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "QUIT";
  defaultCommand.now = now;

  const command = params.command || defaultCommand;

  await childSendAll({command: command});
  return;
}

function childSend(p){

  const params = p || {};

  return new Promise(function(resolve, reject){

    const childId = params.command.childId;
    const command = params.command;

    statsObj.status = "SEND CHILD | CH ID: " + childId + " | " + command.op;

    if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | " + statsObj.status)); }

    if (childHashMap[childId] === undefined || !childHashMap[childId].child || !childHashMap[childId].child.connected) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD SEND ABORTED | CHILD NOT CONNECTED OR UNDEFINED | " + childId));
      return reject(new Error("CHILD NOT CONNECTED OR UNDEFINED: " + childId));
    }

    childHashMap[childId].child.send(command, function(err) {
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
          + " | OP: " + command.op
          + " | ERR: " + err
        ));
        return reject(err);
      }
      resolve();
    });

  });
}

function childSendAll(p){

  const params = p || {};

  let op = "PING";

  if (params.command) {
    op = params.command.op
  }
  else if (params.op) {
    op = params.op;
  }

  const now = params.now || true;

  const defaultCommand = {};
  defaultCommand.op = op;
  defaultCommand.now = now;
  defaultCommand.pingId = getTimeStamp();

  const command = params.command || defaultCommand;

  return new Promise(function(resolve, reject){
    try {
      Object.keys(childHashMap).forEach(async function(childId) {
        if (childHashMap[childId] !== undefined) {
          command.childId = childId;
          await childSend({command: command});
        }
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

async function childInit(p){

  const params = p || {};

  const childId = params.childId;
  const childIdShort = params.childIdShort;
  const config = params.config || {};
  const verbose = params.verbose || false;
  const testMode = params.testMode || false;

  statsObj.status = "INIT CHILD | CH ID: " + childId;

  const command = {
    op: "INIT",
    childId: childId,
    childIdShort: childIdShort,
    testMode: testMode,
    verbose: verbose,
    config: config
  };

  try {
    const response = await childSend({childId: childId, command: command});
    return response;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
      + " | ERR: " + err
      + "\nCOMMAND\n" + jsonPrint(command)
    ));
    throw err;
  }

}

async function childCreate(p){

  statsObj.status = "CHILD CREATE";

  console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATING CHILD"));

  const params = p || {};
  const args = params.args || [];

  const childId = params.childId;
  const childIdShort = params.childIdShort;
  const appPath = params.appPath;
  const env = params.env;
  const config = params.config || {};

  let child = {};
  const options = {};

  options.cwd = params.cwd || configuration.cwd;

  statsObj.status = "CHILD CREATE | CH ID: " + childId + " | APP: " + appPath;

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CREATE CHILD | " + childId));

  try {

    if (env) {
      options.env = env;
    }
    else {
      options.env = {};
      options.env = configuration.DROPBOX;
      options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
      options.env.CHILD_ID = childId;
      options.env.NODE_ENV = "production";
    }

    childHashMap[childId] = {};
    childHashMap[childId].status = "NEW";
    childHashMap[childId].currentNetworkId = false;
    childHashMap[childId].messageQueue = [];

    child = cp.fork(appPath, args, options);

    childHashMap[childId].pid = child.pid;

    child.on("message", async function(m){

      let snId = "---";
      let snIdRes = "---";

      let newNeuralNetwork;

      if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | <R MSG | CHILD " + childId + " | " + m.op)); }

      switch(m.op) {

        case "STATS":
          childHashMap[childId].status = m.data.fsmStatus;
          objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
        break;

        case "EVOLVE_SCHEDULE":

          evolveIterationMeter.mark();

          _.set(resultsHashmap[m.stats.networkId], 'evolve.results.iterations', m.stats.iteration);
          
          console.log(chalkLog(MODULE_ID_PREFIX 
            + " | " + m.childIdShort 
            + " | " + m.stats.networkId
            + " | " + m.stats.inputsId
            + " | S " + moment(m.stats.evolveStart).format(compactDateTimeFormat)
            + " | N " + moment().format(compactDateTimeFormat)
            + " | R " + msToTime(m.stats.evolveElapsed)
            + " | RATE " + (m.stats.iterationRate/1000.0).toFixed(1)
            + " | ETC " + msToTime(m.stats.timeToComplete)
            + " | ETC " + moment().add(m.stats.timeToComplete).format(compactDateTimeFormat)
            + " | ERR " + m.stats.error
            + " | FIT " + m.stats.fitness
            + " | I " + m.stats.iteration + "/" + m.stats.totalIterations
          ));

          if (!statsObj.networkResults[m.stats.networkId] || statsObj.networkResults[m.stats.networkId] === undefined){
            statsObj.networkResults[m.stats.networkId] = {};
            statsObj.networkResults[m.stats.networkId].networkObj = {};
            statsObj.networkResults[m.stats.networkId].networkObj.evolve = {};
            statsObj.networkResults[m.stats.networkId].networkObj.evolve.options = {};
          }

          statsObj.networkResults[m.stats.networkId].startTime = getTimeStamp(m.stats.evolveStart);
          statsObj.networkResults[m.stats.networkId].elapsed = msToTime(m.stats.evolveElapsed);
          statsObj.networkResults[m.stats.networkId].iteration = m.stats.iteration;
          statsObj.networkResults[m.stats.networkId].totalIterations = m.stats.totalIterations;
          statsObj.networkResults[m.stats.networkId].rate = (m.stats.iterationRate/1000.0).toFixed(1);
          statsObj.networkResults[m.stats.networkId].timeToComplete = moment().add(m.stats.timeToComplete).format(compactDateTimeFormat);
          statsObj.networkResults[m.stats.networkId].error = m.stats.error;
          statsObj.networkResults[m.stats.networkId].fitness = m.stats.fitness;

        break;

        case "EVOLVE_COMPLETE":

          try {
            const nn = await networkDefaults(m.networkObj);

            m.statsObj.evolve.results.fitness = statsObj.networkResults[m.networkObj.networkId].fitness;
            statsObj.evolveStats.total += 1;

            snId = (nn.seedNetworkId !== undefined) ? nn.seedNetworkId : "---";
            snIdRes = (nn.seedNetworkId !== undefined) ? nn.seedNetworkRes.toFixed(2) : "---";

            console.log(chalkBlue("\nTNN ========================================================\n"
              + MODULE_ID_PREFIX + " | NETWORK EVOLVE + TEST COMPLETE"
              + "\nTNN |                  " + m.childId
              + "\nTNN | NID:             " + nn.networkId
              + "\nTNN | TECH:            " + nn.networkTechnology
              + "\nTNN | SR%:             " + nn.test.results.successRate.toFixed(2) + "%"
              + "\nTNN | TEST [PASS/SET]: " + nn.test.results.numPassed + "/" + nn.test.results.numTests
              + "\nTNN | SEED:            " + snId
              + "\nTNN | SEED SR%:        " + snIdRes
              + "\nTNN | ELAPSED:         " + msToTime(nn.evolve.elapsed)
              + "\nTNN | ITERTNS:         " + m.statsObj.evolve.results.iterations
              + "\nTNN | ERROR:           " + m.statsObj.evolve.results.error
              + "\nTNN | FITNESS:         " + m.statsObj.evolve.results.fitness
              + "\nTNN | INPUTS ID:       " + nn.inputsId
              + "\nTNN | INPUTS:          " + nn.network.input
              + "\nTNN | HIDDEN:          " + nn.network.hiddenLayerSize
              + "\nTNN | OUTPUTS:         " + nn.network.output
              + "\nTNN | DROPOUT:         " + nn.network.dropout
              + "\nTNN | NODES:           " + nn.network.nodes.length
              + "\nTNN | CONNS:           " + nn.network.connections.length
            ));

            let objSize = sizeof(nn)/ONE_MEGABYTE;

            console.log(chalkError(MODULE_ID_PREFIX + " | NN OBJECT SIZE: " + objSize.toFixed(2) + " MB")); 

            newNeuralNetwork = new global.globalNeuralNetwork(nn);

            objSize = sizeof(newNeuralNetwork)/ONE_MEGABYTE;

            console.log(chalkError(MODULE_ID_PREFIX + " | NN DB DOC SIZE: " + objSize.toFixed(2) + " MB")); 

            newNeuralNetwork.markModified("overallMatchRate");

            await newNeuralNetwork.save();

            resultsHashmap[nn.networkId] = {};
            resultsHashmap[nn.networkId] = omit(nn, ["network", "inputs", "outputs", "inputsObj"]);
            resultsHashmap[nn.networkId].status = "COMPLETE";
            resultsHashmap[nn.networkId].stats = {};
            resultsHashmap[nn.networkId].stats = omitDeep(
              m.statsObj, 
              [
                "inputsObj", 
                "train", 
                "outputs", 
                "normalization", 
                "evolve.options.networkObj.network",
                "evolve.options.networkObj.inputsObj"
              ]
            );


            if (childHashMap[m.childId] === undefined) {
              console.log(chalkError("??? CHILD NOT IN childHashMap ??? | CHILD ID: "+ m.childId));
              childHashMap[m.childId] = {};
              childHashMap[m.childId].status = "IDLE";
            }
            else {
              if (configuration.quitOnComplete) {
                childHashMap[m.childId].status = "COMPLETE";
              }
              else {
                childHashMap[m.childId].status = "READY";
              }
            }

            if (m.statsObj.evolve.results.iterations < nn.evolve.options.iterations) {

              console.log(chalkError(MODULE_ID_PREFIX + " | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
                + " | " + nn.networkId
                + " | ITRNS: " + m.statsObj.evolve.results.iterations
                + " | MIN: " + configuration.globalMinSuccessRate.toFixed(2) + "%"
                + " | " + nn.successRate.toFixed(2) + "%"
              ));

              resultsHashmap[nn.networkId].status = "FAIL";

              printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);
            }
            else if ((nn.test.results.successRate < 100) && 
              ((nn.seedNetworkId && (nn.test.results.successRate > nn.seedNetworkRes)) // better than seed nn
              || (!nn.seedNetworkId && (nn.test.results.successRate >= configuration.localMinSuccessRate)) // no seed but better than local min
              || (!nn.seedNetworkId && (nn.evolve.options.cost === "MSE") && (nn.test.results.successRate >= configuration.localMinSuccessRateMSE)) // no seed but better than local min
              || (nn.test.results.successRate >= configuration.globalMinSuccessRate) // better than global min
              )) { 

              // It's a Keeper!!

              if (!nn.inputsObj || nn.inputsObj === undefined) {
                console.log(chalkAlert(MODULE_ID_PREFIX + " | *** nn.inputsObj UNDEFINED"
                  + " | NN ID: " + nn.networkId
                  + " | IN ID: " + nn.inputsId
                ));
                inputsIdHashMap
              }
              await updateDbInputs({inputsObj: nn.inputsObj, networkId: nn.networkId});

              bestNetworkFile = nn.networkId + ".json";

              networkIdSet.add(nn.networkId);

              if (inputsIdHashMap[nn.inputsId] === undefined) { inputsIdHashMap[nn.inputsId] = new Set(); }
              inputsIdHashMap[nn.inputsId].add(nn.networkId);

              // Add to nn child better than parent array
              if (nn.seedNetworkId && (nn.test.results.successRate < 100) && (nn.test.results.successRate > nn.seedNetworkRes)) {

                betterChildSeedNetworkIdSet.add(nn.networkId);

                nn.betterChild = true;
                resultsHashmap[nn.networkId].betterChild = true;

                console.log(chalk.green(MODULE_ID_PREFIX + " | +++ BETTER CHILD"
                  + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
                  + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
                  + " | SEED: " + nn.seedNetworkId
                  + " | SR: " + nn.seedNetworkRes.toFixed(3) + "%"
                ));
              }
              // no seed but better than localMinSuccessRate, so act like better child and start parent/child chain
              else if (
                   (!nn.seedNetworkId && (nn.test.results.successRate < 100) && (nn.test.results.successRate >= configuration.localMinSuccessRate))
                || (!nn.seedNetworkId && (nn.evolve.options.cost === "MSE") && (nn.test.results.successRate < 100) && (nn.test.results.successRate >= configuration.localMinSuccessRateMSE))
                )
              {

                betterChildSeedNetworkIdSet.add(nn.networkId);

                nn.betterChild = false;
                resultsHashmap[nn.networkId].betterChild = false;

                console.log(chalkGreen(MODULE_ID_PREFIX + " | +++ ADD LOCAL SUCCESS TO BETTER CHILD SET"
                  + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
                  + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
                ));
              }
              else {
                nn.betterChild = false;
                resultsHashmap[nn.networkId].betterChild = false;
              }

              if (inputsNetworksHashMap[nn.inputsId] === undefined) {
                inputsNetworksHashMap[nn.inputsId] = new Set();
              }

              inputsNetworksHashMap[nn.inputsId].add(nn.networkId);

              console.log(chalkLog(MODULE_ID_PREFIX + " | INPUTS ID"
                + " | " + nn.inputsId
                + " | INPUTS: " + nn.inputsObj.meta.numInputs
                + " | " + inputsNetworksHashMap[nn.inputsId].size + " NETWORKS"
              ));

              if ((nn.test.results.successRate < 100) 
                && (nn.test.results.successRate >= configuration.globalMinSuccessRate)) {

                console.log(chalkInfo(MODULE_ID_PREFIX + " | ### SAVING NN FILE TO DROPBOX GLOBAL BEST"
                  + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
                ));

                resultsHashmap[nn.networkId].status = "PASS GLOBAL";

                statsObj.evolveStats.passGlobal += 1;

                let noNetworksInputsFlag = false;

                inputsFailedSet.delete(nn.inputsId);

                if (inputsNoNetworksSet.has(nn.inputsId)) {
                  noNetworksInputsFlag = true;
                  console.log(chalkBlueBold("TNN | GLOBAL BEST | NO NETWORKS INPUTS"
                    + " | " + nn.networkId
                    + " | INPUTS: " + nn.inputsId
                  ));
                  statsObj.evolveStats.noNetworksInputs.push(nn.inputsId);
                  inputsNoNetworksSet.delete(nn.inputsId);
                }

                slackText = "\n*GLOBAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
                slackText = slackText + "\n              " + nn.networkId;
                slackText = slackText + "\nIN:           " + nn.inputsId;
                slackText = slackText + "\nINPUTS:       " + nn.network.input;
                slackText = slackText + "\nINPUTS NO NNs: " + noNetworksInputsFlag;
                slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
                slackText = slackText + "\nELAPSED:      " + msToTime(nn.evolve.elapsed);

                slackSendWebMessage({ channel: slackChannelPassGlobal, text: slackText});

                printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

                saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: bestNetworkFile, obj: nn});
              }
              else if (
                   (nn.test.results.successRate < 100) && (nn.test.results.successRate >= configuration.localMinSuccessRate)
                || ((nn.evolve.options.cost === "MSE") && (nn.test.results.successRate >= configuration.localMinSuccessRateMSE))
                )
              {

                localNetworkFile = nn.networkId + ".json";

                console.log(chalkLog(MODULE_ID_PREFIX + " | ... SAVING NN FILE TO DROPBOX LOCAL BEST"
                  + " | " + localBestNetworkFolder + "/" + localNetworkFile
                ));

                resultsHashmap[nn.networkId].status = "PASS LOCAL";

                inputsFailedSet.delete(nn.inputsId);

                statsObj.evolveStats.passLocal += 1;

                slackText = "\n*LOCAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
                slackText = slackText + "\n              " + nn.networkId;
                slackText = slackText + "\nIN:           " + nn.inputsId;
                slackText = slackText + "\nINPUTS:       " + nn.network.input;
                slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
                slackText = slackText + "\nELAPSED:      " + msToTime(nn.evolve.elapsed);

                slackSendWebMessage({ channel: slackChannelPassLocal, text: slackText });

                saveFileQueue.push({localFlag: false, folder: localBestNetworkFolder, file: localNetworkFile, obj: nn});
              }
            }
            else {
              console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS *OR* NOT BETTER THAN SEED"
                + " | " + nn.networkId
                + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
                + " | GLOBAL SUCCESS: " + configuration.globalMinSuccessRate.toFixed(2) + "%"
              ));

              resultsHashmap[nn.networkId].status = "FAIL";

              if (
                   ((nn.evolve.options.cost !== "MSE") && (nn.test.results.successRate < configuration.localMinSuccessRate))
                || ((nn.evolve.options.cost === "MSE") && (nn.test.results.successRate < configuration.localMinSuccessRateMSE))
                )
              {
                await updateDbInputs({inputsObj: nn.inputsObj, failNetworkId: nn.networkId});
                inputsFailedSet.add(nn.inputsId);
                console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FAILED INPUTS ID TO SET"
                  + " [" + inputsFailedSet.size + "]"
                  + " | " + nn.inputsId
                ));
              }

              slackText = "\n*-FAIL-*";
              slackText = slackText + "\n*" + nn.test.results.successRate.toFixed(2) + "%*";
              slackText = slackText + "\n" + nn.networkId;
              slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);
              slackText = slackText + "\nIN: " + nn.inputsId;
              slackText = slackText + "\nINPUTS: " + nn.network.input;

              slackSendWebMessage({ channel: slackChannelFail, text: slackText });

              statsObj.evolveStats.fail += 1;

              localNetworkFile = nn.networkId + ".json";

              console.log(chalkLog(MODULE_ID_PREFIX + " | ... SAVING NN FILE TO DROPBOX LOCAL FAIL"
                + " | " + localFailNetworkFolder + "/" + localNetworkFile
              ));

              saveFileQueue.push({localFlag: false, folder: localFailNetworkFolder, file: localNetworkFile, obj: nn});
            }

            statsObj.evolveStats.results[nn.networkId] = {};
            statsObj.evolveStats.results[nn.networkId] = resultsHashmap[nn.networkId];

            printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

            await printResultsHashmap();

            evolveIterationMeter.reset();

            if (!configuration.quitOnComplete){
              try{
                await startNetworkCreate({childId: childId, compareTechFlag: true});
              }
              catch(err){
                console.log(chalkError(MODULE_ID_PREFIX 
                  + " | " + childId
                  + " | *** START NETWORK CREATE ERROR: " + err
                ));
              }
            }
          }
          catch(err){
            console.trace(chalkError("EVOLVE_COMPLETE ERROR: " + err));
            throw err;
          }

        break;

        case "EXIT":
        case "QUIT":
        case "ERROR":
        case "INIT":
        case "INIT_COMPLETE":
        case "PONG":
        case "READY":
        case "RESET":
          childHashMap[childId].status = m.data.fsmStatus;
          objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
          childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
        break;

        case "DATA":
          childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
          child.messageQueue.push(m);
        break;

        default:
          console.error(chalkError(MODULE_ID_PREFIX + " | CHILD " + childId + " | UNKNOWN OP: " + m.op));
          childEvents.emit("CHILD_UNKNOWN_OP", { data: { childId: childId, op: m.op } } );
      }
    });

    childHashMap[childId].child = child;

    const initResponse = await childInit({
      childId: childId, 
      childIdShort: childIdShort, 
      config: config, 
      testMode: configuration.testMode,
      verbose: configuration.verbose
    });

    const childPidFile = await touchChildPidFile({ childId: childId, pid: child.pid });

    childHashMap[childId].childPidFile = childPidFile;

    child.on("close", function(){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | CHILD CLOSED | " + childId));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      if ((childHashMap[childId] !== undefined) && childHashMap[childId].currentNetworkId) {
        resultsHashmap[childHashMap[childId].currentNetworkId].status = "CHILD CLOSED";
      }

      delete childHashMap[childId];

    });

    child.on("exit", function(){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | CHILD EXITED | " + childId));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      if ((childHashMap[childId] !== undefined) && childHashMap[childId].currentNetworkId) {
        resultsHashmap[childHashMap[childId].currentNetworkId].status = "CHILD EXIT";
      }

      delete childHashMap[childId];

      quit({cause: "CHILD EXIT", force: true});

    });

    if (quitFlag) {
      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | KILL CHILD IN CREATE ON QUIT FLAG"
        + " | " + getTimeStamp()
        + " | " + childId
      ));
      child.kill();
    }

    return initResponse;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD INIT ERROR"
      + " | ERR: " + err
      + "\nCONFIG\n" + jsonPrint(config)
      + "\nENV\n" + jsonPrint(options.env)
    ));
    throw err;
  }

}

function checkChildState (params) {

  const checkState = params.checkState;
  const noChildrenTrue = params.noChildrenTrue || false;

  return new Promise(function(resolve, reject){

    if (Object.keys(childHashMap).length === 0) {
      resolve(noChildrenTrue);
    }

    let allCheckState = true;

    Object.keys(childHashMap).forEach(function(childId){

      const child = childHashMap[childId];

      if (child === undefined) { 
        console.error("CHILD UNDEFINED");
        return reject(new Error("CHILD UNDEFINED"));
      }

      const cs = ((child.status === "DISABLED") || (child.status === checkState));

      if (!cs) {
        allCheckState = false;
      } 

      if (configuration.verbose) {
        console.log("checkChildState"
          + " | CH ID: " + childId 
          + " | " + child.status 
          + " | CHCK STATE: " + checkState 
          + " | cs: " + cs
          + " | allCheckState: " + allCheckState
        );
      }

    });

    if (configuration.verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | MAIN: " + fsm.getMachineState()
        + " | ALL CHILDREN CHECKSTATE: " + checkState + " | " + allCheckState
      ));
    }

    resolve(allCheckState);

  });
}

async function childPingAll(p){

  const params = p || {};

  const now = params.now || false;

  const defaultCommand = {};
  defaultCommand.op = "PING";
  defaultCommand.now = now;
  defaultCommand.pingId = getTimeStamp();

  const command = params.command || defaultCommand;

  await childSendAll({command: command});
  return;
}

function toggleVerbose(){

  configuration.verbose = !configuration.verbose;

  console.log(chalkLog(MODULE_ID_PREFIX + " | VERBOSE: " + configuration.verbose));

  childSendAll({command: {op: "VERBOSE", verbose: configuration.verbose}}).
  then(function(){

  }).
  catch(function(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR VERBOSE: " + err));
  });
}

function initStdIn() {
  console.log(MODULE_ID_PREFIX + " | STDIN ENABLED");
  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", async function( key ) {
    switch (key) {
      case "a":
        abortCursor = true;
        console.log(chalkLog(MODULE_ID_PREFIX + " | STDIN | ABORT: " + abortCursor));
      break;

      case "K":
        quit({cause: "STDIN K", force: true});
      break;

      case "q":
      case "Q":
        quit({cause: "STDIN Q"});
      break;

      case "S":
      case "s":
        try {
          await showStats((key === "S"));
          await printResultsHashmap();
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
        }
      break;

      case "V":
        toggleVerbose();
      break;

      default:
        console.log(chalkInfo(
          "\nTNN | " + "q/Q: quit"
          + "\nTNN | " + "s: showStats"
          + "\nTNN | " + "S: showStats verbose"
          + "\nTNN | " + "V: toggle verbose"
        ));
    }
  });
}

console.log(chalkBlueBold(
    "\n=======================================================================\n"
  + MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | HOST:          " + hostname);
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | RUN ID:        " + statsObj.runId);
console.log(MODULE_ID_PREFIX + " | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log(MODULE_ID_PREFIX + " | =================================");

setTimeout(async function(){

  try {

    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    initSaveFileQueue(cnf);

    if (configuration.testMode) {
      configuration.trainingSetFile = "trainingSet_test.json";
      configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete_test.json";
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
      console.log(chalkAlert(MODULE_ID_PREFIX + " | trainingSetFile:            " + configuration.trainingSetFile));
      console.log(chalkAlert(MODULE_ID_PREFIX + " | defaultUserArchiveFlagFile: " + configuration.defaultUserArchiveFlagFile));
    }

    console.log(chalkBlueBold(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "--------------------------------------------------------"
    ));

    initSlackRtmClient();
    initSlackWebClient();

    try {
      await connectDb();
      initFsmTickInterval(FSM_TICK_INTERVAL);
      initWatch({rootFolder: DROPBOX_ROOT_FOLDER + configuration.userArchiveFolder});
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MONGO DB CONNECT ERROR"});
    }


  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: "INIT CONFIG ERROR"});
    }
  }
}, 1000);


