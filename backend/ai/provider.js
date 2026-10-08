'use strict';

class AIProvider {
  get configured() {
    return false;
  }

  async generateStructured() {
    throw new Error('AIProvider.generateStructured() must be implemented by a provider.');
  }
}

module.exports = AIProvider;
