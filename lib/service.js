'use strict';
//doc:
//https://github.com/chadxz/imap-simple
//wrap:
//https://github.com/mscdex/node-imap

const goblinName = 'postman';
const Goblin = require('xcraft-core-goblin');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const find = require('lodash/find');
// Define initial logic values
const logicState = {};

// Define logic handlers according rc.json
const logicHandlers = {
  create: (state, action) => {
    return state.set('', {id: action.get('id')});
  },
};

Goblin.registerQuest(goblinName, 'create', function (quest, config) {
  quest.goblin.setX('config', config);
  quest.do();
  return quest.goblin.id;
});

Goblin.registerQuest(goblinName, 'open', function* (quest, next) {
  const config = quest.goblin.getX('config');
  const connection = yield imaps.connect(config);

  quest.goblin.setX('connection', connection);
});

Goblin.registerQuest(goblinName, 'close', function (quest) {
  const connection = quest.goblin.getX('connection');

  if (connection) {
    connection.end();
    quest.goblin.setX('openedBox', null);
    quest.goblin.setX('connection', null);
  }
});

Goblin.registerQuest(goblinName, 'openBox', function* (
  quest,
  boxName,
  searchCriteria,
  fetchOptions,
  next
) {
  const connection = quest.goblin.getX('connection');

  if (!connection) {
    throw new Error('Please open a connection first (open quest)');
  }

  const finalBoxName = boxName || 'INBOX';
  const finalSearchCriteria = searchCriteria || ['UNSEEN'];
  const finalFetchOptions = fetchOptions || {
    bodies: ['HEADER', 'TEXT', ''],
    markSeen: false,
  };

  yield connection.openBox(finalBoxName);
  quest.goblin.setX('openedBox', finalBoxName);

  const messages = yield connection.search(
    finalSearchCriteria,
    finalFetchOptions
  );

  for (const item of [messages[0]]) {
    var all = find(item.parts, {which: ''});
    var id = item.attributes.uid;
    var idHeader = 'Imap-Id: ' + id + '\r\n';

    quest.evt('mail-read', {
      uid: id,
      mail: yield simpleParser(idHeader + all.body, next),
    });
  }
});

Goblin.registerQuest(goblinName, 'moveOpenedBoxMessages', function* (
  quest,
  messagesSource,
  targetBoxName
) {
  const connection = quest.goblin.getX('connection');
  const openedBox = quest.goblin.getX('openedBox');

  if (!connection) {
    throw new Error('Please open a connection first (open quest)');
  }
  if (!openedBox) {
    throw new Error('Please open a box first (openBox quest)');
  }

  yield connection.moveMessage(messagesSource, targetBoxName);
});

Goblin.registerQuest(goblinName, 'test', function* (quest, next) {
  const config = quest.goblin.getX('config');
  const connection = yield imaps.connect(config);
  yield connection.openBox('INBOX');

  const searchCriteria = ['UNSEEN'];
  const fetchOptions = {
    bodies: ['HEADER', 'TEXT', ''],
  };
  const messages = yield connection.search(searchCriteria, fetchOptions);
  for (const item of messages) {
    var all = find(item.parts, {which: ''});
    var id = item.attributes.uid;
    var idHeader = 'Imap-Id: ' + id + '\r\n';
    const mail = yield simpleParser(idHeader + all.body, next);
    console.dir(mail);
  }

  connection.end();
});

Goblin.registerQuest(goblinName, 'delete', function (quest) {});

// Singleton
module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
