/*jslint node: true */
/*jshint sub:true*/

const MODULE_NAME = "twitterNeuralNetwork";
const MODULE_ID_PREFIX = "TNN";
const CHILD_PREFIX = "tnc_node";
const CHILD_PREFIX_SHORT = "NC";

const DEFAULT_BINARY_MODE = true;
const DEFAULT_COMPARE_TECH = false;

const DEFAULT_MAX_FAIL_NETWORKS = 20;

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const _ = require("lodash");

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

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
let dbConnection;

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools(MODULE_ID_PREFIX + "_NNT");

const carrotEvolveOptionsPickArray = [
  "activation",
  // "clear",
  "cost",
  "crossover",
  "efficient_mutation",
  "elitism",
  "equal",
  "error",
  "fitness",
  "fitness_population",
  "growth",
  "iterations",
  // "log",
  "max_nodes",
  "maxConns",
  "maxGates",
  "mutation",
  "mutation_amount",
  "mutation_rate",
  "mutationSelection",
  "network",
  "popsize",
  "population_size",
  "provenance",
  "schedule",
  "selection",
  "threads",
];

const neatapticEvolveOptionsPickArray = [
  "activation",
  // "clear",
  "cost",
  "crossover",
  "elitism",
  "equal",
  "error",
  "fitnessPopulation",
  "growth",
  "iterations",
  // "log",
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

const combinedEvolveOptionsPickArray = _.union(carrotEvolveOptionsPickArray, neatapticEvolveOptionsPickArray);

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const DEFAULT_NETWORK_TECHNOLOGY = "carrot";
const DEFAULT_ENABLE_RANDOM_NETWORK_TECHNOLOGY = false;

const DEFAULT_PURGE_MIN = true; // applies only to parent
const TEST_MODE = false; // applies only to parent
const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = false;

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

// const ONE_KILOBYTE = 1024;
// const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const STATS_UPDATE_INTERVAL = 5*ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;
const SAVE_CACHE_DEFAULT_TTL = 60;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const OFFLINE_MODE = false;

const statsObj = {};
let statsObjSmall = {};
let configuration = {};

const childConfiguration = {};

configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.compareTech = DEFAULT_COMPARE_TECH;

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
configuration.maxFailNetworks = DEFAULT_MAX_FAIL_NETWORKS;
childConfiguration.primaryHost = configuration.primaryHost;
childConfiguration.testMode = configuration.testMode;
childConfiguration.updateUserDb = false;

const empty = require("is-empty");
const path = require("path");
const watch = require("watch");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const shell = require("shelljs");
const touch = require("touch");
const kill = require("tree-kill");
const objectPath = require("object-path");
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const table = require("text-table");
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const fs = require("fs");
const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const renameFileAsync = promisify(fs.rename);
const unlinkFileAsync = promisify(fs.unlink);
const debug = require("debug")("TNN");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");
const omit = require("object.omit");
const omitDeep = require("omit-deep-lodash");

const cp = require("child_process");
const childHashMap = {};

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

const tcuChildName = MODULE_ID_PREFIX + "_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;

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
  try{
    console.log(chalkBlueBold("TNN | SLACK RTM | SEND: " + msg));

    const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

    console.log(chalkLog("TNN | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
    return sendResponse;
  }
  catch(err){
    console.log(chalkAlert(MODULE_ID_PREFIX + " | *** slackSendRtmMessage ERROR: " + err));
    throw err;
  }
}

async function slackSendWebMessage(msgObj){
  try{
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
  catch(err){
    console.log(chalkAlert(MODULE_ID_PREFIX + " | *** slackSendWebMessage ERROR: " + err));
    throw err;
  }
}

// function slackMessageHandler(message){
//   return new Promise(function(resolve, reject){

//     try {

//       console.log(chalkInfo("TNN | MESSAGE | " + message.type + " | " + message.text));

//       if (message.type !== "message") {
//         console.log(chalkAlert("Unhandled MESSAGE TYPE: " + message.type));
//         return resolve();
//       }

//       const text = message.text.trim();
//       const textArray = text.split("|");

//       const sourceMessage = (textArray[2]) ? textArray[2].trim() : "NONE";

//       switch (sourceMessage) {
//         case "END FETCH ALL":
//         case "ERROR":
//         case "FETCH FRIENDS":
//         case "FSM INIT":
//         case "FSM FETCH_ALL":
//         case "GEN AUTO CAT":
//         case "INIT CHILD":
//         case "INIT LANG ANALYZER":
//         case "INIT MAX INPUT HASHMAP":
//         case "INIT NNs":
//         case "INIT RAN NNs":
//         case "INIT RNT CHILD":
//         case "INIT TWITTER USERS":
//         case "INIT TWITTER":
//         case "INIT UNFOLLOWABLE USER SET":
//         case "INIT UNFOLLOWABLE":
//         case "INIT":
//         case "LOAD BEST NN":
//         case "LOAD NN":
//         case "MONGO DB CONNECTED":
//         case "PONG":
//         case "QUIT":
//         case "QUITTING":
//         case "READY":
//         case "RESET":
//         case "SAV NN HASHMAP":
//         case "SLACK QUIT":
//         case "SLACK READY":
//         case "SLACK RTM READY":
//         case "START":
//         case "STATS":
//         case "TEXT": 
//         case "UPDATE HISTOGRAMS":
//         case "UPDATE NN STATS":
//         case "WAIT UPDATE STATS":
//         case "END UPDATE STATS":
//         case "UPDATE USER CAT STATS":
//           resolve();
//         break;
//         case "STATSUS":
//           console.log(chalkInfo(message.text));
//           resolve();
//         break;
//         case "PING":
//           slackSendWebMessage(hostname + " | TNN | PONG")
//           .then(function(){
//             resolve();
//           })
//           .catch(function(err){
//             console.log(chalkAlert(MODULE_ID_PREFIX + " | *** SLACK SEND WEB MESSAGE ERROR: " + err));
//             return reject(err);
//           });
//           resolve();
//         break;
//         case "NONE":
//           resolve();
//         break;
//         default:
//           console.log(chalkAlert("TNN | *** UNDEFINED SLACK MESSAGE: " + message.text));
//           // reject(new Error("UNDEFINED SLACK MESSAGE TYPE: " + message.text));
//           resolve({text: "UNDEFINED SLACK MESSAGE", message: message});
//       }
//     }
//     catch(err){
//       reject(err);
//     }

//   });
// }

async function initSlackWebClient(){
  try {

    const { WebClient } = require("@slack/client");
    slackWebClient = new WebClient(slackRtmToken);

    const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

    conversationsListResponse.channels.forEach(async function(channel){

      debug(chalkLog("TNN | SLACK CHANNEL | " + channel.id + " | " + channel.name));

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

  // slackRtmClient.on("message", async function(message){
  //   if (configuration.verbose) { console.log(chalkLog("TNN | RTM R<\n" + jsonPrint(message))); }
  //   debug(`TNN | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

  //   try {
  //     await slackMessageHandler(message);
  //   }
  //   catch(err){
  //     console.log(chalkError("TNN | *** SLACK RTM MESSAGE ERROR: " + err));
  //   }

  // });

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
const TEST_DROPBOX_NN_LOAD = 15;
const DEFAULT_CHILD_ID_PREFIX = "tnc_node_";

if (hostname === "google") {
  configuration.cwd = "/home/tc/twitterNeuralNetwork";
}
else {
  configuration.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
}

configuration.childAppPath = path.join(configuration.cwd, "neuralNetworkChild.js");
configuration.childIdPrefix = DEFAULT_CHILD_ID_PREFIX;
configuration.childIndex = 0;

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
const DEFAULT_EVOLVE_ARCHITECTURE = "random";
const DEFAULT_EVOLVE_INPUTS_TO_HIDDEN_LAYER_SIZE_RATIO = 0.1;
const DEFAULT_EVOLVE_BEST_NETWORK = false;
const DEFAULT_EVOLVE_ELITISM = 1;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.05;
const DEFAULT_EVOLVE_FITNESS_POPULATION = true;
const DEFAULT_EVOLVE_LOG = 1;
// const DEFAULT_EVOLVE_MUTATION = networkTech.methods.mutation.FFW;
const DEFAULT_EVOLVE_MUTATION = "FFW";
const DEFAULT_EVOLVE_MUTATION_RATE = 0.4;
const DEFAULT_EVOLVE_MUTATION_EFFICIENT = false; // carrot only efficient_mutation
const DEFAULT_EVOLVE_POPSIZE = 20;
const DEFAULT_EVOLVE_GROWTH = 0.0001;
const DEFAULT_EVOLVE_SELECTION = "FITNESS_PROPORTIONATE";
// const DEFAULT_EVOLVE_CLEAR = false;
// const DEFAULT_EVOLVE_AMOUNT = 1;
const DEFAULT_EVOLVE_COST = "MSE";
const DEFAULT_EVOLVE_PROVENANCE = 0;
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
  "MSE",
  "WAPE"
];
const DEFAULT_EVOLVE_SELECTION_ARRAY = [
  "FITNESS_PROPORTIONATE",
  "POWER",
  "TOURNAMENT"
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
const inputsViableSet = new Set();
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

// ==================================================================
// DROPBOX
// ==================================================================
configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const configDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const configHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const childPidFolderLocal = path.join(DROPBOX_ROOT_FOLDER, "config/utility", hostname, "children");

const statsFolder = path.join(DROPBOX_ROOT_FOLDER, "stats",hostname);
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json"
const defaultUnionInputsConfigFile = "default_unionInputsConfig.json";

const defaultInputsFolder = path.join(configDefaultFolder, "inputs");
const globalBestNetworkFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/best/neuralNetworks");

const localBestNetworkFolder = path.join(configHostFolder, "neuralNetworks/best");
const localFailNetworkFolder = path.join(configHostFolder, "neuralNetworks/fail");
const localArchiveNetworkFolder = path.join(configHostFolder, "neuralNetworks/archive");

configuration.local = {};
configuration.local.trainingSetsFolder = configHostFolder + "/trainingSets";
configuration.local.userArchiveFolder = configHostFolder + "/trainingSets/users";

configuration.default = {};
configuration.default.trainingSetsFolder = configDefaultFolder + "/trainingSets";
configuration.default.userArchiveFolder = configDefaultFolder + "/trainingSets/users";

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = configuration[HOST].trainingSetsFolder + "/users";

configuration.userArchiveFolder = configuration.default.userArchiveFolder;

configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNumberChildren = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) 
  ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN 
  : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;

childConfiguration.userArchiveFolder = configuration.userArchiveFolder;
childConfiguration.defaultUserArchiveFlagFile = configuration.defaultUserArchiveFlagFile;
childConfiguration.trainingSetsFolder = configuration.trainingSetsFolder;
childConfiguration.trainingSetFile = configuration.trainingSetFile;
childConfiguration.archiveFileUploadCompleteFlagFolder = configuration.archiveFileUploadCompleteFlagFolder;


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

configuration.selectionArray = (process.env.TNN_EVOLVE_SELECTION_ARRAY !== undefined) 
  ? process.env.TNN_EVOLVE_SELECTION_ARRAY 
  : DEFAULT_EVOLVE_SELECTION_ARRAY;

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
// configuration.evolve.amount = DEFAULT_EVOLVE_AMOUNT;
configuration.evolve.architecture = DEFAULT_EVOLVE_ARCHITECTURE;
// configuration.evolve.clear = DEFAULT_EVOLVE_CLEAR;
configuration.evolve.cost = DEFAULT_EVOLVE_COST;
configuration.evolve.efficient_mutation = DEFAULT_EVOLVE_MUTATION_EFFICIENT;
configuration.evolve.elitism = DEFAULT_EVOLVE_ELITISM;
configuration.evolve.equal = DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = DEFAULT_EVOLVE_ERROR;
configuration.evolve.fitness_population = DEFAULT_EVOLVE_FITNESS_POPULATION;
configuration.evolve.growth = DEFAULT_EVOLVE_GROWTH;
configuration.evolve.iterations = DEFAULT_ITERATIONS;
configuration.evolve.log = DEFAULT_EVOLVE_LOG;
configuration.evolve.mutation = DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutation_rate = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.networkId = DEFAULT_SEED_NETWORK_ID;
configuration.evolve.networkObj = null;
configuration.evolve.popsize = DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.provenance = DEFAULT_EVOLVE_PROVENANCE;
configuration.evolve.selection = DEFAULT_EVOLVE_SELECTION;
configuration.evolve.threads = DEFAULT_EVOLVE_THREADS;
configuration.evolve.useBestNetwork = DEFAULT_EVOLVE_BEST_NETWORK;

statsObj.evolveStats = {};
statsObj.evolveStats.results = {};
statsObj.evolveStats.total = 0;
statsObj.evolveStats.passLocal = 0;
statsObj.evolveStats.passGlobal = 0;
statsObj.evolveStats.fail = 0;
statsObj.evolveStats.viableInputs = [];

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

    if (empty(networkObj)) {
      console.trace(chalkError("networkDefaults ERROR: networkObj UNDEFINED"));
      throw new Error("networkDefaults ERROR: networkObj UNDEFINED");
    }

    if(empty(networkObj.networkTechnology)) { networkObj.networkTechnology = "neataptic"; }
    if(empty(networkObj.betterChild)) { networkObj.betterChild = false; }
    if(empty(networkObj.testCycles)) { networkObj.testCycles = 0; }
    if(empty(networkObj.testCycleHistory)) { networkObj.testCycleHistory = []; }
    if(empty(networkObj.overallMatchRate)) { networkObj.overallMatchRate = 0; }
    if(empty(networkObj.matchRate)) { networkObj.matchRate = 0; }
    if(empty(networkObj.successRate)) { networkObj.successRate = 0; }

    resolve(networkObj);

    // if (!empty(networkObj.network) || !empty(networkObj.networkJson)){

    //   nnTools.convertNetwork({networkObj: networkObj})
    //   .then(function(nnObj){
    //     if (empty(nnObj.hiddenLayerSize)){
    //       nnObj.hiddenLayerSize = calculateHiddenLayerSize({networkObj: nnObj});
    //     }
    //     resolve(nnObj);
    //   })
    //   .catch(function(err){
    //     reject(err);
    //   });
    // }
    // else{
    //   resolve(networkObj);
    // }

  });

}

function printInputsObj(title, inputsObj, format) {

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

function printNetworkObj(title, networkObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalkNetwork;

  console.log(chalkFormat(title
    + " | TECH: " + networkObj.networkTechnology.slice(0,4).toUpperCase()
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

const formatBoolean = function(bool){
  if (bool) {
    return "T";
  }
  return "F";
}

const format = function(input){
  if (empty(input)){
    return "---";
  }
  if (typeof input === "number"){
    return input.toFixed(3);
  }
  if (typeof input === "string"){
    return parseFloat(input).toFixed(3);
  }

  return input;
}

function printResultsHashmap(){

  return new Promise(function(resolve, reject){

    if (Object.keys(resultsHashmap).length === 0){
      return resolve();
    }
    const tableArray = [];

    tableArray.push([
      MODULE_ID_PREFIX + " | NNID",
      "TECH",
      "STATUS",
      "BTR",
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
      "START",
      "ELPSD",
      "ITRS",
      "SPI",
      "ERROR",
      "FIT",
      "RES %"
    ]);

    async.eachSeries(Object.keys(resultsHashmap), function(networkId, cb){

      const networkObj = resultsHashmap[networkId];

      if(empty(networkObj)) {
        return cb("UNDEFINED");
      }
      
      if(empty(networkObj.numInputs)) {
        return cb("numInputs UNDEFINED");
      }
      
      if(empty(networkObj.evolve)) {
        networkObj.evolve.options.activation = "---";
        networkObj.evolve.options.clear = "---";
        networkObj.evolve.options.cost = "---";
        networkObj.evolve.options.growth = "---";
        networkObj.evolve.options.equal = "---";
        networkObj.evolve.options.mutation_rate = 0;
        networkObj.evolve.options.efficient_mutation = "---";
        networkObj.evolve.options.popsize = 0;
        networkObj.evolve.options.population_size = 0;
        networkObj.evolve.options.selection = "---";
        networkObj.evolve.options.elitism = 0;
      }

      let nnTech = "";
      let status = "";
      let snIdRes = 0;
      let iterations = 0;
      let secPerIteration = 0;
      let error = 0;
      let fitness = 0;
      let successRate = 0;
      let elapsed = 0;
      let betterChild = "";
      let hiddenLayerSize = 0;
      let seedNetworkId = false;

      const growth = (networkObj.evolve.options.growth && networkObj.evolve.options.growth !== undefined) ? networkObj.evolve.options.growth.toFixed(8) : "---";
      const selection = (networkObj.evolve.options.selection && networkObj.evolve.options.selection !== undefined) ? networkObj.evolve.options.selection : "---";
      const mutation_rate = (networkObj.evolve.options.mutation_rate && networkObj.evolve.options.mutation_rate !== undefined) ? networkObj.evolve.options.mutation_rate.toFixed(3) : "---";

      nnTech = (networkObj.networkTechnology && networkObj.networkTechnology !== undefined) ? networkObj.networkTechnology.slice(0,4).toUpperCase() : "?";
      status = (networkObj.status && networkObj.status !== undefined) ? networkObj.status : "UNKNOWN";
      snIdRes = format(networkObj.seedNetworkRes);
      betterChild = (networkObj.betterChild && networkObj.betterChild !== undefined) ? formatBoolean(networkObj.betterChild) : "---";
      hiddenLayerSize = (networkObj.hiddenLayerSize && (networkObj.hiddenLayerSize !== undefined)) ? networkObj.hiddenLayerSize : "---";
      seedNetworkId = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkId : false;
      iterations = (networkObj.evolve.results && networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : 0;

      error = ((networkObj.evolve.results && networkObj.evolve.results !== undefined) 
        && (networkObj.evolve.results.error !== undefined)
        && networkObj.evolve.results.error) ? networkObj.evolve.results.error : Infinity;

      fitness = ((networkObj.evolve.results && networkObj.evolve.results !== undefined) 
        && (networkObj.evolve.results.fitness !== undefined)
        && networkObj.evolve.results.fitness) ? networkObj.evolve.results.fitness : -Infinity;

      error = (error > 1000) ? expo(error, 2) : Number.parseFloat(error).toFixed(5);
      fitness = (fitness < -1000) ? expo(fitness, 2) : Number.parseFloat(fitness).toFixed(5);

      successRate = ((networkObj.successRate || (networkObj.successRate === 0)) && networkObj.successRate !== undefined) ? networkObj.successRate.toFixed(2) : 0;
      elapsed = (networkObj.evolve.elapsed && networkObj.evolve.elapsed !== undefined) ? networkObj.evolve.elapsed : (moment().valueOf() - networkObj.evolve.startTime);

      if (networkObj.evolve.results && (networkObj.evolve.results !== undefined) && (iterations > 0)) {
        secPerIteration = (elapsed/(1000*iterations));
      }

      const tableEntry = [
        MODULE_ID_PREFIX + " | " + networkId,
        nnTech,
        status,
        betterChild,
        seedNetworkId,
        snIdRes,
        hiddenLayerSize,
        networkObj.inputsId,
        networkObj.evolve.options.activation,
        formatBoolean(networkObj.evolve.options.clear),
        networkObj.evolve.options.cost,
        selection,
        growth,
        formatBoolean(networkObj.evolve.options.equal),
        mutation_rate,
        formatBoolean(networkObj.evolve.options.efficient_mutation),
        networkObj.evolve.options.population_size,
        networkObj.evolve.options.elitism,
        getTimeStamp(networkObj.evolve.startTime),
        msToTime(elapsed),
        iterations,
        secPerIteration.toFixed(1),
        error,
        fitness,
        successRate
      ];

      for(let i=0; i<tableEntry.length; i++){
        if (tableEntry[i] === undefined || tableEntry[i] === null) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** TABLE INDEX: " + i + " | " + tableEntry[i]));
        }
      }

      tableArray.push(tableEntry);

      if (empty(statsObj.networkResults[networkId])){
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
      statsObj.networkResults[networkId].networkObj.evolve.options = pick(networkObj.evolve.options, combinedEvolveOptionsPickArray);
      statsObj.networkResults[networkId].startTime = getTimeStamp(networkObj.evolve.startTime);
      statsObj.networkResults[networkId].elapsed = msToTime(elapsed);
      statsObj.networkResults[networkId].iterations = iterations;
      statsObj.networkResults[networkId].error = error;
      statsObj.networkResults[networkId].fitness = fitness;
      statsObj.networkResults[networkId].successRate = successRate;

      // async.setImmediate(function() { cb(); });
      cb();

    }, function(err){

      if (err) {
        return reject(err);
      }

      const t = table(tableArray, { 
        align: ["l", "l", "l", "l", "l", "l", "r", "l", "l", "l", "l", "l", "l", "l", "r", "l", "r", "r", "l", "l", "r", "r", "r", "r", "r"] 
      });

      console.log(chalkLog(MODULE_ID_PREFIX + " | === NETWORK RESULTS ========================================================================================================================"));
      console.log(chalkLog(t));
      console.log(chalkLog(MODULE_ID_PREFIX + " | ============================================================================================================================================"));

      resolve();
    });

  });
}

function purgeNetwork(networkId){

  console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX PURGE NETWORK: " + networkId));

  networkIdSet.delete(networkId);
  betterChildSeedNetworkIdSet.delete(networkId);
  skipLoadNetworkSet.add(networkId);

  if (resultsHashmap[networkId] !== undefined) { 
    resultsHashmap[networkId].status = "PURGED";
  }
}

function purgeInputs(inputsId){

  return new Promise(function(resolve, reject){

    try {
      if (!configuration.inputsIdArray.includes(inputsId)){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX PURGE INPUTS: " + inputsId));
        inputsSet.delete(inputsId);
        inputsViableSet.delete(inputsId);
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

async function updateDbInputs(params){

  try{

    if (empty(params.inputsId) && empty(params.inputsObj)) {
      throw new Error("undefined params.inputsId AND params.inputsObj");
    }

    let inputsId;

    if (params.inputsId) {
      inputsId = params.inputsId;
    }
    else if (params.inputsObj && (params.inputsObj !== undefined)){
      inputsId = params.inputsObj.inputsId;
    }
    else{
      throw new Error("undefined params.inputsId AND params.inputsObj");
    }

    const query = { inputsId: inputsId };

    const inputsObj = await wordAssoDb.NetworkInputs.findOne(query);

    if (inputsObj) {

      if(empty(inputsObj.networks)) {
        inputsObj.networks = [];
      }

      if(empty(inputsObj.failNetworks)) {
        inputsObj.failNetworks = [];
      }

      if (params.networkId && !inputsObj.networks.includes(params.networkId)) {
        inputsObj.networks.push(params.networkId);
      }

      if (params.failNetworkId && !inputsObj.failNetworks.includes(params.failNetworkId)) {
        inputsObj.failNetworks.push(params.failNetworkId);
      }

      if (params.inputsObj && params.inputsObj.networks){
        inputsObj.networks = _.union(params.inputsObj.networks, inputsObj.networks);
      }

      if (params.inputsObj && params.inputsObj.failNetworks){
        inputsObj.failNetworks = _.union(params.inputsObj.failNetworks, inputsObj.failNetworks);
      }

      const niDbUpdated = await inputsObj.save();

      if (verbose) { printInputsObj(MODULE_ID_PREFIX + " | +++ INPUTS DB UPDATED", niDbUpdated); }

      return niDbUpdated;
    }
    else if (params.inputsObj && (params.inputsObj !== undefined)) {

      if (params.networkId && !params.inputsObj.networks.includes(params.networkId)) {
        params.inputsObj.networks.push(params.networkId);
      }
      if (params.failNetworkId && !params.inputsObj.failNetworks.includes(params.failNetworkId)) {
        params.inputsObj.failNetworks.push(params.failNetworkId);
      }

      const ni = new wordAssoDb.NetworkInputs(params.inputsObj);

      const niDbUpdated = await ni.save();

      if (verbose) { printInputsObj(MODULE_ID_PREFIX + " | +++ INPUTS DB UPDATED", niDbUpdated); }

      return niDbUpdated;
    }
    else {
      throw new Error("updateDbInputs | INPUTS NOT IN DB + no INPUTS OBJ PARAM");
    }
  }
  catch(e){
    console.log(chalkError("*** updateDbInputs | INPUTS FIND ONE ERROR: " + e
      + "\nINPUTS ID: " + inputsId
    ));
    console.log(e);
    throw e;
  }
}

function checkInputsViability(p){

  const params = p || {};

  const maxFailNetworks = params.maxFailNetworks || configuration.maxFailNetworks;
  // const minNetworksTotal = params.minNetworksTotal || configuration.minNetworksTotal;

  const numPassNetworks = params.inputsObj.networks.length;
  const numFailNetworks = params.inputsObj.failNetworks.length;

  if (numFailNetworks <= maxFailNetworks){
    return true;
  }

  if (numPassNetworks >= numFailNetworks){
    return true;
  }

  return false;
}

async function loadNetworkFile(params){

  let path;

  if (params.path) {
    path = params.path;
  }
  else {
    path = params.folder + "/" + params.file;
  }

  console.log(chalkInfo(MODULE_ID_PREFIX + " | <<< LOAD NN FILE"
    + " | FOLDER: " + params.folder
    + " | FILE: " + params.file
    + " | PATH: " + path
  ));

  const networkObj = await tcUtils.loadFileRetry({folder: params.folder, file: params.file});

  // const networkObjValid = await nnTools.validateNetwork({networkId: networkObj.networkId, networkObj: networkObj});

  // if (!networkObjValid) {
  //   console.log(chalkInfo(MODULE_ID_PREFIX + " | ??? INVALID NETWORK ... PURGING"
  //     + " | " + path
  //   ));
  //   purgeNetwork(networkObj.networkId);
  //   return;
  // }

  const dbInputsObj = await updateDbInputs({inputsId: networkObj.inputsId, networkId: networkObj.networkId});

  const inputsObj = dbInputsObj.toObject();

  if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {

    if (configuration.archiveNotInInputsIdArray && path.toLowerCase().includes(localBestNetworkFolder.toLowerCase())){
      
      console.log(chalkInfo(MODULE_ID_PREFIX + " | 000 NN INPUTS NOT IN INPUTS ID ARRAY ... ARCHIVING"
        + " | NUM INPUTS: " + networkObj.numInputs
        + " | INPUTS ID: " + networkObj.inputsId
        + " | " + path
      ));

      await renameFileAsync(path.join(localBestNetworkFolder, params.file), path.join(localArchiveNetworkFolder, params.file));
      return;
    }
    else if (configuration.deleteNotInInputsIdArray && path.toLowerCase().includes(localBestNetworkFolder.toLowerCase())){
      console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING"
        + " | NUM INPUTS: " + networkObj.numInputs
        + " | INPUTS ID: " + networkObj.inputsId
        + " | " + path
      ));
      await unlinkFileAsync(path.join(localBestNetworkFolder, params.file));
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
    // && (networkObj.networkTechnology !== "carrot") 
    || (networkObj.overallMatchRate >= configuration.globalMinSuccessRate))) {

    networkIdSet.add(networkObj.networkId);

    if(empty(inputsIdHashMap[networkObj.inputsId])) { inputsIdHashMap[networkObj.inputsId] = new Set(); }
    inputsIdHashMap[networkObj.inputsId].add(networkObj.networkId);

    printNetworkObj(MODULE_ID_PREFIX 
      + " | LOCAL > GLOBAL"
      + " | " + params.folder, 
      networkObj, 
      chalkGreen
    );

    saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: params.file, obj: networkObj});
    await unlinkFileAsync({folder: params.folder, file: params.file});
  }

  //========================
  // NETWORK PASS SUCCESS or MATCH MIN
  //========================

  const passed = networkPass({folder: params.folder, purgeMin: params.purgeMin, networkObj: networkObj});

  if (passed) {

    networkIdSet.add(networkObj.networkId);

    if(empty(inputsIdHashMap[networkObj.inputsId])) { inputsIdHashMap[networkObj.inputsId] = new Set(); }
    inputsIdHashMap[networkObj.inputsId].add(networkObj.networkId);

    printNetworkObj(MODULE_ID_PREFIX + " | +++ NN SET [" + networkIdSet.size + " IN SET]", networkObj);

    if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {
      currentBestNetwork = networkObj;
      printNetworkObj(MODULE_ID_PREFIX + " | ===> NEW BEST NN <===", networkObj, chalkGreen);
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

    if(empty(inputsNetworksHashMap[networkObj.inputsId])) {
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

      if(empty(inputsIdHashMap[nnDb.inputsId])) { inputsIdHashMap[nnDb.inputsId] = new Set(); }
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

    purgeNetwork(networkObj.networkId);
    await purgeInputs(networkObj.inputsId);
    await unlinkFileAsync({folder: params.folder, file: params.file});
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

async function loadInputsFile(params){

  try {

    const inputsObj = await tcUtils.loadFileRetry({folder: params.folder, file: params.file});

    if (empty(inputsObj)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
      throw new Error("JSON UNDEFINED");
    }

    if(empty(inputsObj.meta)) {
      inputsObj.meta = {};
      inputsObj.meta.numInputs = 0;
      for(const inputType of Object.keys(inputsObj.inputs)){
        inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
      }
    }

    const dbInputsObj = await updateDbInputs({inputsObj: inputsObj});

    inputsSet.add(dbInputsObj.inputsId);

    const inputsViable = checkInputsViability({inputsObj: dbInputsObj});

    if (inputsViable){

      inputsViableSet.add(dbInputsObj.inputsId);

      console.log(chalkBlueBold(MODULE_ID_PREFIX 
        + " | +++ VIABLE NETWORKS INPUTS [" + inputsViableSet.size + " IN SET]"
        + " | P/F: " + dbInputsObj.networks.length + "/" + dbInputsObj.failNetworks.length
        + " | " + dbInputsObj.meta.numInputs
        + " INPUTS | " + dbInputsObj.inputsId
      ));
    }
    else {
      inputsViableSet.delete(dbInputsObj.inputsId);
      console.log(chalkBlueBold(MODULE_ID_PREFIX 
        + " | XXX NOT VIABLE NETWORKS INPUTS [" + inputsViableSet.size + " IN SET]"
        + " | P/F: " + dbInputsObj.networks.length + "/" + dbInputsObj.failNetworks.length
        + " | " + dbInputsObj.meta.numInputs
        + " | " + dbInputsObj.meta.numInputs
        + " INPUTS | " + dbInputsObj.inputsId
      ));
    }

    if(empty(inputsNetworksHashMap[dbInputsObj.inputsId])) {
      inputsNetworksHashMap[dbInputsObj.inputsId] = new Set();
    }

    console.log(chalkInfo(MODULE_ID_PREFIX
      + " | +++ INPUTS [" + inputsSet.size + " IN HM]"
      + " | " + dbInputsObj.meta.numInputs + " INPUTS"
      + " | " + dbInputsObj.inputsId
    ));

    return inputsObj;
  }
  catch(err) {
    console.log(chalkError(MODULE_ID_PREFIX + " | INPUTS LOAD FILE ERROR: " + err));
    throw err;
  }
}

async function updateDbNetwork(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "UPDATE DB NETWORKS";

    if (configuration.verbose) {
      printNetworkObj(MODULE_ID_PREFIX + " | [" + networkIdSet.size + "] >>> UPDATE NN DB", params.networkObj)
      .then(function(){

      })
      .catch(function(err){
        return reject(err);
      });
    }

    const networkObj = params.networkObj;
    const seedNetworkId = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined && networkObj.seedNetworkId !== "false") ? networkObj.seedNetworkId : null;
    const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
    const testHistoryItem = (params.testHistoryItem !== undefined) ? params.testHistoryItem : false;
    const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    const query = { networkId: networkObj.networkId };

    const update = {};

    update.$setOnInsert = { 
      networkTechnology: networkObj.networkTechnology,
      seedNetworkId: seedNetworkId,
      seedNetworkRes: networkObj.seedNetworkRes,
      successRate: networkObj.successRate, 
      numInputs: networkObj.numInputs,
      numOutputs: networkObj.numOutputs,
      inputsId: networkObj.inputsId,
      // inputsObj: networkObj.inputsObj,
      outputs: networkObj.outputs,
      evolve: networkObj.evolve,
      test: networkObj.test
    };

    update.$set = { 
      network: networkObj.networkJson,
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

    wordAssoDb.NeuralNetwork.findOneAndUpdate(query, update, options, async function(err, nnDbUpdated){

      if (err) {
        console.log(chalkError("*** updateDbNetwork | NETWORK FIND ONE ERROR: " + err));
        return reject(err);
      }

      if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | +++ NN DB UPDATED", nnDbUpdated); }

      const nnObj = nnDbUpdated.toObject();
      delete nnObj._id;

      resolve(nnObj);
    });
  });
}

function listFolders(params){

  return new Promise(function(resolve, reject){

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... GETTING FOLDERS ENTRIES"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    let totalEntries = [];

    async.forEach(params.folders, async function(folder){

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... GETTING FOLDERS ENTRIES"
        + " | FOLDER: " + folder
      ));

      try {

        const entries = await readdirAsync(folder);

        const entryObjs = entries.map(function(entry){

          const entryObj = {};

          entryObj.folder = folder;
          entryObj.file = entry;
          entryObj.path = path.join(folder, entry);

          debug("entryObj\n" + jsonPrint(entryObj));

          return entryObj;

        });

        console.log(chalkLog(MODULE_ID_PREFIX + " | READ DIR " + folder + " | ENTRIES: " + entryObjs.length));
        totalEntries = _.concat(totalEntries, entryObjs);
        return;
      }
      catch(err){
        return err;
      }

    }, function(err){

      if (err) { 
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR listFolders: " + err));
        return reject(err);
      }

      resolve(totalEntries);
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

async function loadBestNetworkFolders (p){

  const params = p || {};

  let numNetworksLoaded = 0;

  console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING BEST NN FOLDERS"
    + " | " + params.folders.length + " FOLDERS"
    + "\n" + jsonPrint(params.folders)
  ));

  const files = await listFolders({folders: params.folders});

  console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... FOUND " + files.length + " FILES IN NN FOLDERS"));

  for (const fileObj of files) {

    if (configuration.testMode && (numNetworksLoaded >= TEST_DROPBOX_NN_LOAD)) {
      continue;
    }
    
    if (fileObj.file.toLowerCase() === bestRuntimeNetworkFileName.toLowerCase()) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + fileObj.file));
      continue;
    }
    
    if (!fileObj.file.endsWith(".json")) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + fileObj.file));
      continue;
    }

    const fileNameArray = fileObj.file.split(".");
    const networkId = fileNameArray[0];

    if (skipLoadNetworkSet.has(networkId)){
      console.log(chalkInfo(MODULE_ID_PREFIX + " | NN IN SKIP SET | SKIPPING ..."
        + " | " + fileObj.path
        + " | " + networkId
      ));
      continue;
    }
    
    if (configuration.verbose) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | NN FOUND"
        + " | " + fileObj.path
        + " | " + networkId
      ));
    }

    try{
      const networkObj = await loadNetworkFile({
        folder: fileObj.folder, 
        file: fileObj.file, 
        purgeMin: params.purgeMin
      });

      if (networkObj) {
        numNetworksLoaded += 1;
      }
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN ENTRY ERROR: " + err
        + " | " + fileObj.path
        + " | " + networkId
      ));
    }

    return;
  }

}

async function loadInputsFolders (p){

  const params = p || {};

  console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING INPUTS FOLDERS"
    + " | " + params.folders.length + " FOLDERS"
    + "\n" + jsonPrint(params.folders)
  ));

  const files = await listFolders({folders: params.folders});

  for (const fileObj of files) {

    try{

      if (!fileObj.file.endsWith(".json")) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING INPUTS LOAD OF " + fileObj.path));
        continue;
      }

      const fileNameArray = fileObj.file.split(".");
      const inputsId = fileNameArray[0];

      if (!configuration.inputsIdArray.includes(inputsId)){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | --- INPUTS ... NOT IN INPUTS ARRAY"
          + " | " + fileObj.path
        ));
        continue;
      }

      if (configuration.verbose) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | INPUTS FOUND"
          + " | " + inputsId
          + " | " + fileObj.path
        ));
      }

      const inputsObj = await loadInputsFile({folder: fileObj.folder, file: fileObj.file});

      if (inputsObj.inputsId || (inputsObj.inputsId !== undefined)) {
        inputsSet.add(inputsObj.inputsId);
        printInputsObj(MODULE_ID_PREFIX + " | +++ INPUTS DB UPDATED", inputsObj);
      }
      else{
        console.log(chalkError(MODULE_ID_PREFIX + " | *** INPUTS OBJ ERROR | UNDEFINED INPUTS ID\n" + jsonPrint(inputsObj)));
      }
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD INPUTS FILE ERROR: " + err));
      throw err;
    }

  }

  return;

}

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

async function initWatch(params){

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT WATCH\n" + jsonPrint(params)));

  watch.createMonitor(params.rootFolder, watchOptions, function (monitor) {

    const loadArchive = async function (f) {

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

      if (f.endsWith(configuration.defaultUserArchiveFlagFile)){

        console.log(chalkLog(MODULE_ID_PREFIX + " | LOAD USER ARCHIVE FLAG FILE: " + params.rootFolder + "/" + configuration.defaultUserArchiveFlagFile));

        let archiveFlagObj;

        try {
          archiveFlagObj = await tcUtils.loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
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

  return;

}

async function generateSeedInputsNetworkId(params){

  try{
    console.log(chalkLog(MODULE_ID_PREFIX + " | ... GENERATE SEED INPUTS/NETWORK ..."));

    const config = params.config || {};

    //
    // if available use better child as seed nn
    //

    if (betterChildSeedNetworkIdSet.size > 0) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | USING BETTER CHILD SEED NETWORK | AVAIL BETTER CHILDREN: " + betterChildSeedNetworkIdSet.size));

      config.seedNetworkId = betterChildSeedNetworkIdSet.keys().next().value;

      console.log(chalkLog(MODULE_ID_PREFIX + " | ... SEARCH DB FOR BETTER CHILD SEED NETWORK: " + config.seedNetworkId));

      const networkObj = await wordAssoDb.NeuralNetwork.findOne({networkId: config.seedNetworkId}).lean();

      if (!networkObj) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** BETTER CHILD SEED NETWORK ERROR: NN NOT IN DB | SEED NN ID: " + config.seedNetworkId));
        throw new Error("SEED NN NOT IN DB: " + config.seedNetworkId);
      }

      // const networkObj = nnDoc.toObject();
      console.log(chalkLog(MODULE_ID_PREFIX + " | FOUND DB BETTER CHILD SEED NETWORK: " + networkObj.networkId));

      betterChildSeedNetworkIdSet.delete(config.seedNetworkId);

      config.numInputs = networkObj.numInputs;
      config.networkTechnology = networkObj.networkTechnology;
      config.seedInputsId = networkObj.inputsId;
      config.isBetterChildSeed = true;

      console.log(chalkBlueBold(MODULE_ID_PREFIX
        + " | USING BETTER CHILD SEED [" + betterChildSeedNetworkIdSet.size + " REMAINING NNs IN BETTER CHILD POOL]"
        + " | NN ID: " + networkObj.networkId
        + " | TECH: " + networkObj.networkTechnology
        + " | INPUTS ID: " + networkObj.inputsId
      ));

      return config;
    }
    
    //
    // no better children, so try a viable input set
    //
    
    const viableInputsIdArray = [...inputsViableSet].sort();
    const failedInputsIdArray = [...inputsFailedSet];
    const availableInputsIdArray = _.difference(viableInputsIdArray, failedInputsIdArray);

    if (availableInputsIdArray.length > 0) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | VIABLE NETWORKS INPUTS: " + availableInputsIdArray.length));

      availableInputsIdArray.sort();

      config.seedInputsId = availableInputsIdArray.pop(); // most recent input
      config.inputsId = config.seedInputsId;

      console.log(chalkBlue(MODULE_ID_PREFIX + " | SEED INPUTS: " + config.inputsId));

      const inputsObj = await wordAssoDb.NetworkInputs.findOne({inputsId: config.inputsId}).lean();
      config.numInputs = inputsObj.meta.numInputs;

      console.log(chalkBlueBold(MODULE_ID_PREFIX
        + " | VIABLE INPUT"
        + " | VIABLE INPUTS: " + inputsViableSet.size
        + " | AVAIL INPUTS: " + availableInputsIdArray.length
        + " | SEED INPUTS: " + config.seedInputsId
        + " | NUM INPUTS: " + config.numInputs
      ));

      return config;
    }

    //
    // no input set with no networks, so maybe random network
    //
    
    const useRandomNetwork = (Math.random() <= configuration.seedNetworkProbability);

    if (useRandomNetwork && (Object.keys(inputsIdHashMap).length > 0)) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | USING RANDOM SEED NETWORK | AVAIL SEED NNs: " + Object.keys(inputsIdHashMap).length));

      const randomInputsId = randomItem(Object.keys(inputsIdHashMap));
      const randomNetworkIdSet = inputsIdHashMap[randomInputsId];

      console.log(chalkLog(MODULE_ID_PREFIX + " | RANDOM SEED: " + randomInputsId + " | INPUTS NN SET SIZE: " + randomNetworkIdSet.size));

      if (randomNetworkIdSet.size > 0) {

        const randomNetworkId = randomItem([...randomNetworkIdSet]);

        const networkObj = await wordAssoDb.NeuralNetwork.findOne({networkId: randomNetworkId}).lean();

        if (!networkObj) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** GENERATE SEED INPUTS NETWORK ID ERROR: NN NOT IN DB | RANDOM NN ID: " + randomNetworkId));
          throw new Error("RANDOM NN NOT IN DB: " + randomNetworkId);
        }

        // const networkObj = nnDoc.toObject();

        config.networkTechnology = networkObj.networkTechnology;
        config.seedNetworkId = randomNetworkId;
        config.seedInputsId = randomInputsId;
        config.inputsId = randomInputsId;
        config.numInputs = networkObj.numInputs;
        config.isBetterChildSeed = false;

        console.log(chalkBlueBold(MODULE_ID_PREFIX
          + " | USE RANDOM SEED NETWORK [" + randomNetworkIdSet.size + " NNs IN SEED POOL]"
          + " | NN ID: " + networkObj.networkId
          + " | TECH: " + networkObj.networkTechnology
          + " | INPUTS ID: " + networkObj.inputsId
        ));

        return config;
      }
      else{
        console.log(chalkBlueBold(MODULE_ID_PREFIX
          + " | generateSeedInputsNetworkId | NO RANDOM SEED NETWORKS [" + randomNetworkIdSet.size + " NNs IN SEED POOL]"
        ));
        return config;
      }
    }
    else if (inputsSet.size === 0) {

      //
      // no random network, so random inputSet
      //
    
      console.log(chalkError(MODULE_ID_PREFIX
        + " | *** EMPTY INPUTS SET [" + inputsSet.size + "]"
      ));
      throw new Error("EMPTY INPUTS SET");
    }
    else{
      config.seedInputsId = randomItem([...inputsSet]);
      const inputsObj = await wordAssoDb.NetworkInputs.findOne({inputsId: config.seedInputsId}).lean();
      config.numInputs = inputsObj.meta.numInputs;

      console.log(chalkLog(MODULE_ID_PREFIX
        + " | RANDOM INPUT [" + inputsSet.size + "]"
        + " | " + config.seedInputsId
        + " | NUM INPUTS: " + config.numInputs
      ));

      return config;
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** GENERATE SEED INPUTS NETWORK ID ERROR: " + err));
    throw err;
  }
}

function calculateHiddenLayerSize(params){

  const networkObj = params.networkObj;

  let hiddenLayerSize = 0;

  for(const node of networkObj.networkJson.nodes){
    if (node.type === "hidden") { hiddenLayerSize += 1; }
  }

  return hiddenLayerSize;

}

async function generateRandomEvolveConfig(p){

  const params = p || {};

  statsObj.status = "GENERATE EVOLVE CONFIG";

  console.log(chalkBlue(MODULE_ID_PREFIX + " | GENERATE RANDOM EVOLVE CONFIG"));

  let config = {};

  config.networkCreateMode = "evolve";
  config.binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  config.networkTechnology = (configuration.enableRandomTechnology) ? randomItem(["neataptic", "carrot"]) : configuration.networkTechnology;

  console.log(chalkBlue(MODULE_ID_PREFIX + " | NETWORK TECHNOLOGY: " + config.networkTechnology));

  debug(chalkLog(MODULE_ID_PREFIX + " | NETWORK CREATE MODE: " + config.networkCreateMode));

  config = await generateSeedInputsNetworkId({config: config});

  config.activation = randomItem(configuration.activationArray);
  config.clear = false;

  // neataptic doesn't have WAPE cost

  const costArray = (config.networkTechnology === "neataptic") ? _.pull(configuration.costArray, "WAPE") : configuration.costArray;
  config.cost = randomItem(costArray);

  config.efficient_mutation = configuration.evolve.efficient_mutation;
  config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);
  config.equal = true;
  config.error = configuration.evolve.error;
  config.fitness_population = configuration.evolve.fitness_population;
  config.growth = randomFloat(EVOLVE_GROWTH_RANGE.min, EVOLVE_GROWTH_RANGE.max);
  config.iterations = configuration.evolve.iterations;
  config.log = configuration.evolve.log;
  config.mutation = configuration.evolve.mutation;
  config.mutation_amount = 1;
  config.mutation_rate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  config.popsize = configuration.evolve.popsize;
  config.population_size = configuration.evolve.popsize;
  config.provenance = configuration.evolve.provenance;
  config.selection = randomItem(configuration.selectionArray);
  config.threads = configuration.evolve.threads;

  if (configuration.enableSeedNetwork && config.seedNetworkId && (config.seedNetworkId !== undefined) && (config.seedNetworkId !== false) && networkIdSet.has(config.seedNetworkId)) {

    try{

      const networkObj = await wordAssoDb.NeuralNetwork.findOne({ networkId: config.seedNetworkId }).lean();

      if (!networkObj) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DB FIND SEED NN ERROR | " + config.seedNetworkId));
        throw new Error("SEED NN not found: " + config.seedNetworkId);
      }

      // const networkObj = nnDoc.toObject();

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ DB FIND SEED NN | " + networkObj.networkId));

      const dbNetworkObj = await networkDefaults(networkObj);
      // const networkObjValid = await nnTools.validateNetwork({networkId: dbNetworkObj.networkId, networkObj: dbNetworkObj});

      // if (!networkObjValid) {
      //   console.log(chalkInfo(MODULE_ID_PREFIX + " | ??? INVALID NETWORK ... PURGING: " + dbNetworkObj.networkId));
      //   purgeNetwork(dbNetworkObj.networkId);
      //   throw new Error("INVALID NETWORK: " + dbNetworkObj.networkId);
      // }

      config.hiddenLayerSize = (dbNetworkObj.hiddenLayerSize && (dbNetworkObj.hiddenLayerSize !== undefined)) ? dbNetworkObj.hiddenLayerSize : 0;

      config.architecture = "loadedNetwork";
      config.inputsId = dbNetworkObj.inputsId;
      config.seedNetworkId = dbNetworkObj.networkId;
      config.seedNetworkRes = dbNetworkObj.successRate;

      console.log(MODULE_ID_PREFIX + " | SEED NETWORK:      " + dbNetworkObj.networkId);
      console.log(MODULE_ID_PREFIX + " | SEED NETWORK TECH: " + dbNetworkObj.networkTechnology);
      console.log(MODULE_ID_PREFIX + " | HIDDEN NODES:      " + dbNetworkObj.hiddenLayerSize);
      console.log(MODULE_ID_PREFIX + " | SEED INPUTS:       " + dbNetworkObj.inputsId);

      if (configuration.randomizeSeedOptions) {
        console.log(chalkLog(MODULE_ID_PREFIX + " | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId));
        config.activation = randomItem([config.activation, dbNetworkObj.evolve.options.activation]);
        // config.clear = randomItem([config.clear, dbNetworkObj.evolve.options.clear]);
        config.cost = randomItem([config.cost, dbNetworkObj.evolve.options.cost]);
        config.elitism = randomItem([config.elitism, dbNetworkObj.evolve.options.elitism]);
        config.equal = randomItem([config.equal, dbNetworkObj.evolve.options.equal]);
        config.error = randomItem([config.error, dbNetworkObj.evolve.options.error]);
        config.fitness_population = randomItem([config.fitness_population, dbNetworkObj.evolve.options.fitness_population]);
        config.growth = randomItem([config.growth, dbNetworkObj.evolve.options.growth]);
        config.mutation_rate = randomItem([config.mutation_rate, (dbNetworkObj.evolve.options.mutation_rate || dbNetworkObj.evolve.options.mutationRate)]);
        config.mutation_amount = randomItem([config.mutation_amount, (dbNetworkObj.evolve.options.mutation_amount || dbNetworkObj.evolve.options.mutationAmount)]);
        config.selection = randomItem([config.selection, dbNetworkObj.evolve.options.selection]);
      }
      else {
        console.log(chalkLog(MODULE_ID_PREFIX + " | USE SEED NETWORK OPTIONS | " + config.seedNetworkId));
        config.activation = dbNetworkObj.evolve.options.activation;
        // config.clear = dbNetworkObj.evolve.options.clear;
        config.cost = dbNetworkObj.evolve.options.cost;
        config.elitism = dbNetworkObj.evolve.options.elitism;
        config.equal = dbNetworkObj.evolve.options.equal;
        config.error = dbNetworkObj.evolve.options.error;
        config.growth = dbNetworkObj.evolve.options.growth;
        config.mutation_rate = dbNetworkObj.evolve.options.mutation_rate || dbNetworkObj.evolve.options.mutationRate;
        config.mutation_amount = dbNetworkObj.evolve.options.mutation_amount || dbNetworkObj.evolve.options.mutationAmount;
        config.selection = dbNetworkObj.evolve.options.selection || dbNetworkObj.evolve.options.selection;
      }

      return config;
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** SEED NETWORK ERROR | " + config.seedNetworkId + " | ERROR: " + err));
      throw new Error("SEED NETWORK ERROR: " + config.seedNetworkId);
    }
  }
  else { // not seed network

    if (config.seedInputsId && (config.seedInputsId !== undefined) && inputsSet.has(config.seedInputsId)) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | USE SEED INPUTS ID | " + config.seedInputsId));

      try{

        const inputsObj = await wordAssoDb.NetworkInputs.findOne({inputsId: config.seedInputsId}).lean();

        if (!inputsObj) {
          console.log(chalkError("TNN | *** LOAD INPUTS ERROR | NOT FOUND"
            + " | INPUTS ID: " + config.seedInputsId
          ));
          throw new Error(config.seedInputsId + " NOT IN inputsSet");
        }

        config.inputsId = inputsObj.inputsId;

        config.hiddenLayerSize = parseInt((configuration.inputsToHiddenLayerSizeRatio * inputsObj.meta.numInputs) + 3);
        config.hiddenLayerSize = randomItem([0,config.hiddenLayerSize]);

        config.architecture = (config.hiddenLayerSize > 0) ? "perceptron" : "random";

        config.inputsId = config.seedInputsId;

        console.log(MODULE_ID_PREFIX + " | " + config.architecture.toUpperCase() + " ARCH | SEED INPUTS: " + config.seedInputsId);

        return config;
      }
      catch(err){
        console.log(chalkError("TNN | *** LOAD INPUTS ERROR"
          + " | INPUTS ID: " + config.seedInputsId
          + " | ERROR: " + err
        ));
        throw new Error(config.seedInputsId + " NOT IN inputsSet");
      }
    }
    else {
      console.log("TNN | *** ERROR *** | PERCEPTRON ARCH | seedInputsId " + config.seedInputsId + " NOT IN inputsSet");
      throw new Error(config.seedInputsId + " NOT IN inputsSet");
    }
  }

}

async function initNetworkCreate(params){

  try {

    const childId = params.childId;
    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const networkId = params.networkId;
    const compareTech = (params.compareTech !== undefined) ? params.compareTech : configuration.compareTech;

    statsObj.status = "INIT NETWORK CREATE";

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT NETWORK CREATE"
      + " | CHILD " + childId
      + " | NNC ID: " + networkId
      + " | COMPARE TECH: " + compareTech
    ));

    let messageObj;
    let networkCreateObj = {};

    let childConf;

    if (compareTech && configuration.previousChildConfig && configuration.enableRandomTechnology) {

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
      childConf = await generateRandomEvolveConfig({binaryMode: binaryMode});
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

    messageObj.seedNetworkId = (messageObj.seedNetworkId && messageObj.seedNetworkId !== undefined && messageObj.seedNetworkId !== "false") ? messageObj.seedNetworkId : false;
    messageObj.seedNetworkRes = (messageObj.seedNetworkId && messageObj.seedNetworkId !== undefined && messageObj.seedNetworkId !== "false") ? messageObj.seedNetworkRes : null;

    console.log(chalkBlue("\nTNN | START NETWORK EVOLVE"));

    console.log(chalkBlue(
               MODULE_ID_PREFIX + " | NN ID:             " + networkId
      + "\n" + MODULE_ID_PREFIX + " | TECHNOLOGY:        " + messageObj.networkTechnology
      + "\n" + MODULE_ID_PREFIX + " | ARCHITECTURE:      " + messageObj.architecture
      + "\n" + MODULE_ID_PREFIX + " | SEED:              " + messageObj.seedNetworkId
      + "\n" + MODULE_ID_PREFIX + " | SEED RES:          " + messageObj.seedNetworkRes
      + "\n" + MODULE_ID_PREFIX + " | INPUTS ID:         " + messageObj.inputsId
      + "\n" + MODULE_ID_PREFIX + " | INPUTS:            " + messageObj.numInputs
      + "\n" + MODULE_ID_PREFIX + " | HIDDEN LAYER SIZE: " + messageObj.hiddenLayerSize
      + "\n" + MODULE_ID_PREFIX + " | EFF MUTATION:      " + messageObj.efficient_mutation
      + "\n" + MODULE_ID_PREFIX + " | ACTIVATION:        " + messageObj.activation
      + "\n" + MODULE_ID_PREFIX + " | COST:              " + messageObj.cost
      + "\n" + MODULE_ID_PREFIX + " | SELECTION:         " + messageObj.selection
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
    networkCreateObj.numInputs = messageObj.numInputs;
    networkCreateObj.inputsId = messageObj.inputsId;
    networkCreateObj.evolve = {};
    networkCreateObj.evolve.startTime = moment().valueOf();
    networkCreateObj.evolve.endTime = moment().valueOf();
    networkCreateObj.evolve.complete = false;
    networkCreateObj.evolve.options = {};
    networkCreateObj.evolve.options = pick(childConf, combinedEvolveOptionsPickArray);

    resultsHashmap[messageObj.testRunId] = networkCreateObj;

    await printResultsHashmap();
    await childSend({command: messageObj});

    console.log(chalkInfo(MODULE_ID_PREFIX + " | END initNetworkCreate"));
    return;

  }
  catch(err){
    console.trace(MODULE_ID_PREFIX + " | INIT CREATE NETWORK ERROR ", err);
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
let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

configuration.slackChannel = {};

async function initWatchAllConfigFolders(p){

  try{

    const params = p || {};

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH ALL CONFIG FILES\n" + jsonPrint(params)));

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

    watch.createMonitor(globalBestNetworkFolder, options, function (monitorNetworks) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH GLOBAL NETWORKS FOLDER: " + globalBestNetworkFolder));

      monitorNetworks.on("created", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (!fileNameArray.includes("archive") && file.endsWith(".json") && !file.startsWith("bestRuntimeNetwork")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ NETWORK FILE CREATED: " + f));
          try{
            await delay({period: 30*ONE_SECOND});
            await loadNetworkFile({folder: globalBestNetworkFolder, file: file});
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
          try{
            await delay({period: 30*ONE_SECOND});
            await loadNetworkFile({folder: globalBestNetworkFolder, file: file});
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

    watch.createMonitor(defaultInputsFolder, options, function (monitorInputs) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH INPUTS CONFIG FOLDER: " + defaultInputsFolder));

      monitorInputs.on("created", async function(f){
        const fileNameArray = f.split("/");
        const file = fileNameArray[fileNameArray.length-1];
        if (file.startsWith("inputs_")) {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ INPUTS FILE CREATED: " + f));
          try{
            await delay({period: 30*ONE_SECOND});
            await loadInputsFile({folder: defaultInputsFolder, file: file});
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
          try{
            await delay({period: 30*ONE_SECOND});
            await loadInputsFile({folder: defaultInputsFolder, file: file});
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

    watch.createMonitor(configDefaultFolder, options, function (monitorDefaultConfig) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH DEFAULT CONFIG FOLDER: " + configDefaultFolder));

      monitorDefaultConfig.on("created", async function(f){
        if (f.endsWith(configDefaultFile)){
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

        if (f.endsWith(configDefaultFile)){
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

    watch.createMonitor(configHostFolder, options, function (monitorHostConfig) {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH HOST CONFIG FOLDER: " + configHostFolder));

      monitorHostConfig.on("created", async function(f){
        if (f.endsWith(configHostFile)){
          await loadAllConfigFiles();
          await loadCommandLineArgs();
        }
      });

      monitorHostConfig.on("changed", async function(f){
        if (f.endsWith(configHostFile)){
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

  try {

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

    await initWatchAllConfigFolders();

    const configArgs = Object.keys(configuration);

    configArgs.forEach(function(arg){
      if (arg === "inputsIdArray") {
        console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg].length + " INPUT IDS");
      }
      else if (_.isObject(configuration[arg])) {
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

async function connectDb(){

  try {

    statsObj.status = "CONNECTING MONGO DB";

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await wordAssoDb.connect(MODULE_ID + "_" + process.pid);

    db.on("error", async function(err){
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

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    return db;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================
function delay(p) {

  const params = p || {};
  const period = params.period || 10*ONE_SECOND;
  const interval = ONE_SECOND;
  const verbose = params.verbose || false;
  let delayInterval;

  const delayStartMoment = moment();
  const delayEndMoment = moment().add(period, "ms");

  return new Promise(function(resolve){

    if (verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | +++ DELAY START | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
    }

    delayInterval = setInterval(function(){

      if (verbose) {
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | ... DELAY ... "
          + " | PERIOD: " + msToTime(period)
          + " | INTERVAL: " + interval + " MS"
          + " | START: " + getTimeStamp(delayStartMoment) 
          + " | END: " + getTimeStamp(delayEndMoment) 
          + " | NOW: " + getTimeStamp() 
        ));
      }

      if (moment().isAfter(delayEndMoment)){
        console.log(chalkAlert(MODULE_ID_PREFIX 
          + " | XXX DELAY END "
          + " | PERIOD: " + msToTime(period)
          + " | INTERVAL: " + msToTime(interval)
          + " | START: " + getTimeStamp(delayStartMoment) 
          + " | END: " + getTimeStamp(delayEndMoment) 
          + " | NOW: " + getTimeStamp() 
        ));
        clearInterval(delayInterval);
        resolve();
      }

    }, interval);

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

        if(empty(childHashMap[childId])) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD NOT IN HM"
            + " | " + childId
          ));
        }
        else if (childHashMap[childId].pid !== childPid) {
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

    if ((params.pid === undefined) && empty(childHashMap[params.childId])) {
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

      tcUtils.saveFile({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

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

    const loadedConfigObj = await tcUtils.loadFile({folder: params.folder, file: params.file, noErrorNotFound: params.noErrorNotFound });

    if (loadedConfigObj === undefined) {
      if (params.noErrorNotFound) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ... SKIP LOAD CONFIG FILE: " + params.folder + "/" + params.file));
        return newConfiguration;
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        throw new Error("JSON UNDEFINED");
      }
    }

    if (loadedConfigObj instanceof Error) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj));
    }

    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

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

    if (loadedConfigObj.TNN_BINARY_MODE !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_BINARY_MODE: " + loadedConfigObj.TNN_BINARY_MODE);
      if ((loadedConfigObj.TNN_BINARY_MODE === true) || (loadedConfigObj.TNN_BINARY_MODE === "true")) {
        newConfiguration.binaryMode = true;
      }
      if ((loadedConfigObj.TNN_BINARY_MODE === false) || (loadedConfigObj.TNN_BINARY_MODE === "false")) {
        newConfiguration.binaryMode = false;
      }
    }

    if (loadedConfigObj.TNN_COMPARE_TECH !== undefined) {
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_COMPARE_TECH: " + loadedConfigObj.TNN_COMPARE_TECH);
      if ((loadedConfigObj.TNN_COMPARE_TECH === true) || (loadedConfigObj.TNN_COMPARE_TECH === "true")) {
        newConfiguration.compareTech = true;
      }
      if ((loadedConfigObj.TNN_COMPARE_TECH === false) || (loadedConfigObj.TNN_COMPARE_TECH === "false")) {
        newConfiguration.compareTech = false;
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

    if (loadedConfigObj.TNN_MAX_FAIL_NETWORKS !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_MAX_FAIL_NETWORKS: " + loadedConfigObj.TNN_MAX_FAIL_NETWORKS);
      newConfiguration.maxFailNetworks = loadedConfigObj.TNN_MAX_FAIL_NETWORKS;
    }

    if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_SEED_NETWORK_PROBABILITY: " + loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY);
      newConfiguration.seedNetworkProbability = loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
    }

    if (loadedConfigObj.TNN_EVOLVE_COST_ARRAY !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_COST_ARRAY: " + loadedConfigObj.TNN_EVOLVE_COST_ARRAY);
      newConfiguration.costArray = loadedConfigObj.TNN_EVOLVE_COST_ARRAY;
    }

    if (loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_SELECTION_ARRAY: " + loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY);
      newConfiguration.selectionArray = loadedConfigObj.TNN_EVOLVE_SELECTION_ARRAY;
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

    if (loadedConfigObj.TNN_EVOLVE_POPSIZE !== undefined){
      console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_POPSIZE: " + loadedConfigObj.TNN_EVOLVE_POPSIZE);
      newConfiguration.evolve.popsize = loadedConfigObj.TNN_EVOLVE_POPSIZE;
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
      if(empty(newConfiguration.evolve)) { newConfiguration.evolve = {}; }
      newConfiguration.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
    }

    return newConfiguration;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD DROPBOX CONFIG: " + fullPath
      + "\n" + jsonPrint(err)
    ));
    throw err;
  }
}

async function loadAllConfigFiles(){

  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({folder: configDefaultFolder, file: configDefaultFile});

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + configDefaultFolder + "/" + configDefaultFile));
  }
  
  const hostConfig = await loadConfigFile({folder: configHostFolder, file: configHostFile});

  if (hostConfig) {
    hostConfiguration = hostConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + configHostFolder + "/" + configHostFile));
  }
  
  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

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


let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if(empty(saveCacheTtl)) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if(empty(saveCacheCheckPeriod)) { saveCacheCheckPeriod = 10; }

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

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT DROPBOX SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(async function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();
      saveFileObj.verbose = true;

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await tcUtils.saveFile(saveFileObj);
        console.log(chalkLog(
          MODULE_ID_PREFIX 
          + " | SAVED FILE"
          + " [Q: " + saveFileQueue.length + "] " 
          + " [$: " + saveCache.getStats().keys + "] " 
          + saveFileObj.folder + "/" + saveFileObj.file
        ));
        statsObj.queues.saveFileQueue.busy = false;
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX 
          + " | *** SAVE FILE ERROR ... RETRY"
          + " | ERROR: " + err
          + " | " + saveFileObj.folder + "/" + saveFileObj.file
        ));
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


  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  try{
    await slackSendWebMessage({channel: slackChannel, text: slackText});
    fsm.fsm_quit();
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

      if (!dbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          dbConnection.close(async function () {
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

const networkTechnology = { name: "networkTechnology", alias: "c", type: String};
const threads = { name: "threads", alias: "t", type: Number};
const maxNumberChildren = { name: "maxNumberChildren", alias: "N", type: Number};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadAllInputs = { name: "loadAllInputs", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "F", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number};
const seedNetworkProbability = { name: "seedNetworkProbability", alias: "p", type: Number };
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  networkTechnology,
  threads,
  maxNumberChildren,
  useLocalTrainingSets,
  loadAllInputs,
  loadTrainingSetFromFile,
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

    async.eachSeries(commandLineConfigKeys, function(arg, cb){

      if (arg === "threads"){
        configuration.evolve.threads = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }

      else if (arg === "evolveIterations"){
        configuration.evolve.iterations = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }

      else if (arg === "networkTechnology"){
        configuration.networkTechnology = commandLineConfig[arg];
        configuration.enableRandomTechnology = false;
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.networkTechnology);
      }
      else{
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

  try {

    statsObj.status = "LOAD NETWORK INPUTS CONFIG";

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | LOAD NETWORK INPUTS CONFIG FILE: " + configDefaultFolder + "/" + params.file
    ));

    const networkInputsObj = await tcUtils.loadFileRetry({folder: configDefaultFolder, file: params.file});

    configuration.inputsIdArray = _.union(configuration.inputsIdArray, networkInputsObj.INPUTS_IDS);

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | LOADED NETWORK INPUTS ARRAY"
      + " | " + networkInputsObj.INPUTS_IDS.length + " ITEMS IN FILE"
      + " | " + configuration.inputsIdArray.length + " TOTAL ITEMS IN ARRAY"
      // + "\n" + jsonPrint(configuration.inputsIdArray) + " TOTAL ITEMS IN ARRAY"
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
          await loadBestNetworkFolders({folders: [globalBestNetworkFolder, localBestNetworkFolder]});
          await loadInputsFolders({folders: [defaultInputsFolder]});

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
                await startNetworkCreate({childId: childId, binaryMode: configuration.binaryMode, compareTech: configuration.compareTech});
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
  }
};

const fsm = Stately.machine(fsmStates);

async function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);

  return;
}

//=========================================================================
// CHILD PROCESS
//=========================================================================
configuration.reinitializeChildOnClose = false;

function maxChildren(){
  return getNumberOfChildren() >= configuration.maxNumberChildren;
}

function getNumberOfChildren(){
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

  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const compareTech = (params.compareTech !== undefined) ? params.compareTech : configuration.compareTech;
  const networkId = getNewNetworkId();

  console.log(chalkBlueBold("\n========================================================================================\n"
    + MODULE_ID_PREFIX + " | " + params.childId + " | >>> START NETWORK CREATE | " + networkId
    + "\n========================================================================================\n"
  ));

  childHashMap[params.childId].currentNetworkId = networkId;

  await initNetworkCreate({childId: params.childId, networkId: networkId, binaryMode: binaryMode, compareTech: compareTech});

  return;

}

function childStartAll(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const compareTech = (params.compareTech !== undefined) ? params.compareTech : configuration.compareTech;

    console.log(chalkBlue(MODULE_ID_PREFIX + " | START EVOLVE ALL CHILDREN: compareTech: " + compareTech + " | NUM CH: " + Object.keys(childHashMap).length));

    async.eachSeries(Object.keys(childHashMap), async function(childId) {

      try{
        if (childHashMap[childId] !== undefined){
          await startNetworkCreate({childId: childId, binaryMode: binaryMode, compareTech: compareTech});
          return;
        }
        else{
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD NOT IN childHashMap: " + childId))
          return;
        }
      }
      catch(err){
        return err;
      }

    }, function(err){
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD START ALL ERROR: " + err));
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

    if (configuration.verbose || configuration.testMode) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | >T MESSAGE | " + getTimeStamp() + " | OP: " + command.op)); 
    }

    if (empty(childHashMap[childId]) || !childHashMap[childId].child || !childHashMap[childId].child.connected) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD SEND ABORTED | CHILD NOT CONNECTED OR UNDEFINED | " + childId));
      return reject(new Error("CHILD NOT CONNECTED OR UNDEFINED: " + childId));
    }

    childHashMap[childId].child.send(command);

    resolve();
  });
}

async function childSendAll(p){

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

  for(const childId of Object.keys(childHashMap)){
    if (childHashMap[childId] !== undefined) {
      command.childId = childId;
      await childSend({command: command});    
    }
  }

  return;
}

async function childInit(p){

  let command;

  try {
    const params = p || {};

    const childId = params.childId;
    const childIdShort = params.childIdShort;
    const verbose = params.verbose || false;
    const testMode = params.testMode || false;

    statsObj.status = "INIT CHILD | CH ID: " + childId;

    command = {
      op: "INIT",
      moduleIdPrefix: childIdShort,
      childId: childId,
      childIdShort: childIdShort,
      testMode: testMode,
      verbose: verbose,
      configuration: childConfiguration
    };

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

function expo(x, f) {
  return Number.parseFloat(x).toExponential(f);
}

async function evolveCompleteHandler(params){

  try {

    const m = params.m;

    const nn = await wordAssoDb.NeuralNetwork.findOne({networkId: m.networkId}).lean();

    nn.seedNetworkId = (nn.seedNetworkId && nn.seedNetworkId !== undefined && nn.seedNetworkId !== "false") ? nn.seedNetworkId : false;

    m.statsObj.fitness = statsObj.networkResults[nn.networkId].fitness;
    statsObj.evolveStats.total += 1;

    const snIdRes = (nn.seedNetworkId && nn.seedNetworkRes && nn.seedNetworkRes !== undefined) ? parseFloat(nn.seedNetworkRes).toFixed(2) : "---";

    console.log(chalkBlueBold(
        "\nTNN | ========================================================"
      + "\nTNN | NETWORK EVOLVE + TEST COMPLETE"
      + "\nTNN | ========================================================"
      + "\nTNN | CHILD:      " + m.childId
      + "\nTNN | NID:        " + nn.networkId
      + "\nTNN | TECH:       " + nn.networkTechnology
      + "\nTNN | SR%:        " + nn.test.results.successRate.toFixed(2) + "%"
      + "\nTNN | TEST [P/T]: " + nn.test.results.numPassed + "/" + nn.test.results.numTests
      + "\nTNN | SEED:       " + nn.seedNetworkId
      + "\nTNN | SEED SR%:   " + snIdRes
      + "\nTNN | ELAPSED:    " + msToTime(nn.evolve.elapsed)
      + "\nTNN | ITERTNS:    " + m.statsObj.iterations
      + "\nTNN | ERROR:      " + m.statsObj.error
      + "\nTNN | FITNESS:    " + m.statsObj.fitness
      + "\nTNN | INPUTS ID:  " + nn.inputsId
      + "\nTNN | INPUTS:     " + nn.networkJson.input
      + "\nTNN | HIDDEN:     " + nn.networkJson.hiddenLayerSize
      + "\nTNN | OUTPUTS:    " + nn.networkJson.output
      + "\nTNN | DROPOUT:    " + nn.networkJson.dropout
      + "\nTNN | NODES:      " + nn.networkJson.nodes.length
      + "\nTNN | CONNS:      " + nn.networkJson.connections.length
      + "\nTNN | ========================================================\n"
    ));

    resultsHashmap[nn.networkId] = {};
    resultsHashmap[nn.networkId] = omit(nn, ["network", "networkJson", "networkRaw", "inputs", "outputs", "inputsObj"]);
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
        "evolve.options.networkObj.networkJson",
        "evolve.options.networkObj.networkRaw",
        "evolve.options.networkObj.inputsObj"
      ]
    );

    if(empty(childHashMap[m.childId])) {
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

    if ((nn.test.results.successRate < 100) && 
      ((nn.seedNetworkId && nn.seedNetworkId !== undefined && nn.seedNetworkId !== "false" && (nn.test.results.successRate >= nn.seedNetworkRes)) // better than seed nn
      || (!nn.seedNetworkId && (nn.test.results.successRate >= configuration.localMinSuccessRate)) // no seed but better than local min
      || (!nn.seedNetworkId && (nn.evolve.options.cost === "MSE") && (nn.test.results.successRate >= configuration.localMinSuccessRateMSE)) // no seed but better than local min
      || (nn.test.results.successRate >= configuration.globalMinSuccessRate) // better than global min
      )) { 

      // It's a Keeper!!

      await updateDbInputs({inputsId: nn.inputsId, networkId: nn.networkId});

      bestNetworkFile = nn.networkId + ".json";

      networkIdSet.add(nn.networkId);

      if(empty(inputsIdHashMap[nn.inputsId])) { inputsIdHashMap[nn.inputsId] = new Set(); }

      inputsIdHashMap[nn.inputsId].add(nn.networkId);

      // Add to nn child better than parent array
      if (nn.seedNetworkId && (nn.test.results.successRate < 100) && (nn.seedNetworkRes > 0) && (nn.test.results.successRate >= nn.seedNetworkRes)) {

        betterChildSeedNetworkIdSet.add(nn.networkId);

        nn.betterChild = true;
        resultsHashmap[nn.networkId].betterChild = true;

        console.log(chalk.green(MODULE_ID_PREFIX + " | +++ BETTER CHILD"
          + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
          + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
          + " | SEED: " + nn.seedNetworkId
          + " | SR: " + nn.seedNetworkRes + "%"
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

      if(empty(inputsNetworksHashMap[nn.inputsId])) {
        inputsNetworksHashMap[nn.inputsId] = new Set();
      }

      inputsNetworksHashMap[nn.inputsId].add(nn.networkId);

      console.log(chalkLog(MODULE_ID_PREFIX + " | INPUTS ID"
        + " | " + nn.inputsId
        + " | INPUTS: " + nn.numInputs
        + " | " + inputsNetworksHashMap[nn.inputsId].size + " NETWORKS"
      ));

      if ((nn.test.results.successRate < 100) 
        && (nn.test.results.successRate >= configuration.globalMinSuccessRate)) {

        console.log(chalkInfo(MODULE_ID_PREFIX + " | ### SAVING NN FILE TO DROPBOX GLOBAL BEST"
          + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
        ));

        resultsHashmap[nn.networkId].status = "GLOBAL";

        statsObj.evolveStats.passGlobal += 1;

        inputsFailedSet.delete(nn.inputsId);

        if (inputsViableSet.has(nn.inputsId)) {
          console.log(chalkBlueBold("TNN | GLOBAL BEST | VIABLE NETWORKS INPUTS"
            + " | " + nn.networkId
            + " | INPUTS: " + nn.inputsId
          ));
          statsObj.evolveStats.viableInputs.push(nn.inputsId);
          inputsViableSet.delete(nn.inputsId);
        }

        slackText = "\n*GLOBAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
        slackText = slackText + "\n" + nn.networkId;
        slackText = slackText + "\nTECH: " + nn.networkTechnology;
        slackText = slackText + "\nIN: " + nn.inputsId;
        slackText = slackText + "\nINPUTS: " + nn.networkJson.input;
        slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
        slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

        await slackSendWebMessage({ channel: slackChannelPassGlobal, text: slackText});

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

        resultsHashmap[nn.networkId].status = "LOCAL";

        inputsFailedSet.delete(nn.inputsId);

        statsObj.evolveStats.passLocal += 1;

        if (inputsViableSet.has(nn.inputsId)) {
          console.log(chalkBlueBold("TNN | LOCAL BEST | VIABLE NETWORKS INPUTS"
            + " | " + nn.networkId
            + " | INPUTS: " + nn.inputsId
          ));
          statsObj.evolveStats.viableInputs.push(nn.inputsId);
          inputsViableSet.delete(nn.inputsId);
        }

        slackText = "\n*LOCAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
        slackText = slackText + "\n" + nn.networkId;
        slackText = slackText + "\nTECH: " + nn.networkTechnology;
        slackText = slackText + "\nIN: " + nn.inputsId;
        slackText = slackText + "\nINPUTS: " + nn.networkJson.input;
        slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
        slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

        await slackSendWebMessage({ channel: slackChannelPassLocal, text: slackText });

        saveFileQueue.push({localFlag: false, folder: localBestNetworkFolder, file: localNetworkFile, obj: nn});
      }
    }
    else {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS *OR* NOT BETTER THAN SEED"
        + " | " + nn.networkId
        + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        + " | GLOBAL SUCCESS: " + configuration.globalMinSuccessRate.toFixed(2) + "%"
      ));

      resultsHashmap[nn.networkId].status = "- fail -";

      if (
           ((nn.evolve.options.cost !== "MSE") && (nn.test.results.successRate < configuration.localMinSuccessRate))
        || ((nn.evolve.options.cost === "MSE") && (nn.test.results.successRate < configuration.localMinSuccessRateMSE))
        )
      {
        await updateDbInputs({inputsId: nn.inputsId, failNetworkId: nn.networkId});
        inputsFailedSet.add(nn.inputsId);
        console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FAILED INPUTS ID TO SET"
          + " [" + inputsFailedSet.size + "]"
          + " | " + nn.inputsId
        ));
      }

      slackText = "\n*FAIL | " + nn.test.results.successRate.toFixed(2) + "%*";
      slackText = slackText + "\n" + nn.networkId;
      slackText = slackText + "\nTECH: " + nn.networkTechnology;
      slackText = slackText + "\nIN: " + nn.inputsId;
      slackText = slackText + "\nINPUTS: " + nn.networkJson.input;
      slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
      slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);

      await slackSendWebMessage({ channel: slackChannelFail, text: slackText });

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

    return;

  }
  catch(err){
    console.log(chalkError("EVOLVE_COMPLETE ERROR: " + err));
    throw err;
  }
}

async function childMessageHandler(params){

  try{

    const childId = params.childId;
    const m = params.message;
    const binaryMode = params.binaryMode;
    const compareTech = params.compareTech;

    let error = 0;
    let fitness = 0;

    if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | <R MSG | CHILD " + childId + " | " + m.op)); }

    switch(m.op) {

      case "STATS":
        // if (configuration.testMode) { console.log(chalkLog(MODULE_ID_PREFIX + " | <R TNC STATS | " + m.fsmStatus)); }
        childHashMap[childId].status = m.fsmStatus;
        objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
        return;

      case "EVOLVE_SCHEDULE":

        // if (configuration.testMode) { console.log(chalkLog(MODULE_ID_PREFIX + " | <R TNC EVOLVE_SCHEDULE\n" + jsonPrint(m))); }

        _.set(resultsHashmap[m.stats.networkId], "evolve.results.iterations", m.stats.iteration);

        error = (m.stats.error > 1000) ? expo(m.stats.error, 2) : Number.parseFloat(m.stats.error);
        fitness = (m.stats.fitness < -1000) ? expo(m.stats.fitness, 2) : Number.parseFloat(m.stats.fitness);

        _.set(resultsHashmap[m.stats.networkId], "evolve.results.error", error);
        _.set(resultsHashmap[m.stats.networkId], "evolve.results.fitness", fitness);

        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | " + m.childIdShort 
          + " | " + m.stats.networkTechnology.slice(0,4).toUpperCase()
          + " | BIN: " + m.stats.binaryMode
          + " | " + m.stats.networkId
          + " | " + m.stats.inputsId
          + " | ERR " + error
          + " | FIT " + fitness
          + " | S " + moment(m.stats.evolveStart).format(compactDateTimeFormat)
          + " N " + moment().format(compactDateTimeFormat)
          + " R " + msToTime(m.stats.evolveElapsed)
          + " | ETC " + msToTime(m.stats.timeToComplete)
          + " " + moment().add(m.stats.timeToComplete).format(compactDateTimeFormat)
          + " | " + (m.stats.iterationRate/1000.0).toFixed(1) + " spi"
          + " | I " + m.stats.iteration + "/" + m.stats.totalIterations
        ));

        if (empty(statsObj.networkResults[m.stats.networkId])){
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

      return;

      case "EVOLVE_COMPLETE":
        try{
          await evolveCompleteHandler({m: m, childId: childId});
          await startNetworkCreate({childId: childId, binaryMode: binaryMode, compareTech: compareTech});
        }
        catch(e){
          console.log(chalkError(MODULE_ID_PREFIX 
            + " | " + childId
            + " | *** EVOLVE_COMPLETE ERROR: " + e
          ));
        }
      return;

      case "EXIT":
      case "QUIT":
      case "ERROR":
      case "INIT":
      case "INIT_COMPLETE":
      case "PONG":
      case "READY":
      case "RESET":
        childHashMap[childId].status = m.fsmStatus;
        objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
      return;

      default:
        console.log(chalkError(MODULE_ID_PREFIX + " | CHILD " + childId + " | *** ERROR childMessageHandler UNKNOWN OP: " + m.op));
        throw new Error("UNKNOWN CHILD MESSAGE OP: " + m.op);
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** childMessageHandler ERROR: " + err));
    throw err;
  }
}

async function childCreate(p){

  let config;
  const options = {};

  try {

    statsObj.status = "CHILD CREATE";

    const params = p || {};
    const args = params.args || [];

    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const compareTech = (params.compareTech !== undefined) ? params.compareTech : configuration.compareTech;

    const childId = params.childId;
    const childIdShort = params.childIdShort;
    const appPath = params.appPath;
    const env = params.env;
    config = params.config || {};

    let child = {};

    options.cwd = params.cwd || configuration.cwd;

    statsObj.status = "CHILD CREATE | CH ID: " + childId + " | APP: " + appPath;

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CREATE CHILD | " + childId));


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

    const childPidFile = await touchChildPidFile({ childId: childId, pid: child.pid });

    childHashMap[childId].childPidFile = childPidFile;
    childHashMap[childId].child = child;

    childHashMap[childId].child.on("disconnect", function(){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD DISCONNECT | " + childId));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("close", function(){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD CLOSED | " + childId));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      delete childHashMap[childId];
    });

    childHashMap[childId].child.on("exit", function(){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD EXITED | " + childId));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      delete childHashMap[childId];

      quit({cause: "CHILD EXIT", force: true});
    });

    childHashMap[childId].child.on("error", function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD ERROR: " + err));

      shell.cd(childPidFolderLocal);
      shell.rm(childPidFile);

      delete childHashMap[childId];

      quit({cause: "CHILD ERROR: " + err});
    })

    childHashMap[childId].child.on("message", async function(message){

      await childMessageHandler({childId: childId, message: message, binaryMode: binaryMode, compareTech: compareTech});

      if (configuration.verbose) { 
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | <R MESSAGE | " + getTimeStamp()
          + " | OP: " + message.op
        )); 
      }

    });

    if (quitFlag) {
      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | KILL CHILD IN CREATE ON QUIT FLAG"
        + " | " + getTimeStamp()
        + " | " + childId
      ));
      childHashMap[childId].child.kill();
    }

    const childInitParams = {};
    childInitParams.childId = childId;
    childInitParams.childIdShort = childIdShort;
    childInitParams.configuration = childConfiguration;
    childInitParams.trainingSetsFolder = configuration.trainingSetsFolder;
    childInitParams.testMode = configuration.testMode;
    childInitParams.verbose = configuration.verbose;

    const initResponse = await childInit(childInitParams);

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

      if(empty(child)) { 
        console.log(chalkError("CHILD UNDEFINED"));
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

    await initSlackRtmClient();
    await initSlackWebClient();

    try {
      dbConnection = await connectDb();
      await initFsmTickInterval(FSM_TICK_INTERVAL);
      await initWatch({rootFolder: configuration.userArchiveFolder});
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


