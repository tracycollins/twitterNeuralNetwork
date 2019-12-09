const neataptic = require("neataptic");
const carrot = require("@liquid-carrot/carrot");

async function main(){

  const numInputs = 20;
  const numOutputs = 3;

  const network = new carrot.Network(numInputs, numOutputs);
  // const network = new neataptic.Network(numInputs, numOutputs);

  const trainingSet = [];

  for(let j=0; j<500; j++){

    const datum = {};
    datum.input = [];
    datum.output = [];

    for(let i=0; i<numInputs; i++){
      const inputValue = Math.round(Math.random());
      datum.input.push(inputValue);
    }

    for(let i=0; i<numOutputs; i++){
      const outputValue = Math.round(Math.random());
      datum.output.push(outputValue);
    }

    trainingSet.push(datum);
  }

  console.log("trainingSet\n" , trainingSet);

  const options = {
    mutation: carrot.methods.mutation.FFW,
    error: 0.05,
    // equal: true,
    // elitism: 5,
    // mutation_rate: 0.5,
    iterations: 100,
    log: 1,
    threads: 1
  };

  console.log("options\n" , options);

  try{
    const results = await network.evolve(trainingSet, options);
    console.log("results\n", results);
    console.log("network.activate(trainingSet[0]: " + network.activate(trainingSet[0].input));

    const networkJson = network.toJSON();
    const networkRaw = carrot.Network.fromJSON(networkJson);
    
    const results2 = await networkRaw.evolve(trainingSet, options);
    console.log("results2\n", results2);
    console.log("networkRaw.activate(trainingSet[0]: " + networkRaw.activate(trainingSet[0].input));
    return;
  }
  catch(err){
    console.trace(err);
    throw err;
  }
}

main();

