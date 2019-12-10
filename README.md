# twitterNeuralNetwork
Neural Network generator (evolve for now)

- generates neural networks that are used to categorize twitter users
- currently evolves networks using Neataptic and Liquid Carror libraries
- forks children (neuralNetworkChild.js) that create networks
- generic data set of categorized users is transformed to conform with each particular input set before evolve + test
- generates evolve options
- can evolve network from scratch, or from seed network
- if new network tests above global success threshold, uploaded to common global folder to be used by other twitterNeuralNetwork instances on other machines
