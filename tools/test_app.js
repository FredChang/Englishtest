// Mock DOM environment based on index.html
const fs = require('fs');

global.window = global;
global.document = {
  getElementById: (id) => {
    return {
      id,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      addEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      style: {},
      getAttribute: () => null,
      setAttribute: () => {},
      disabled: false,
      value: '',
      innerHTML: '',
      textContent: ''
    };
  },
  querySelectorAll: () => []
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.navigator = {
  userAgent: 'node',
  serviceWorker: undefined
};
global.speechSynthesis = {
  getVoices: () => [],
  speak: () => {},
  cancel: () => {}
};
global.SpeechSynthesisUtterance = function() {};
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([]),
  text: () => Promise.resolve('')
});

import('../web/js/app.js').then(() => {
  console.log('app.js executed successfully without uncaught errors!');
}).catch(err => {
  console.error('app.js EXCEPTION:', err);
});
