'use strict'

const {
  createStore, applyMiddleware, combineReducers, compose
} = require('redux')

const { default: thunk } = require('redux-thunk')
const { default: createSagaMiddleware } = require('redux-saga')
const { log: logger, warn, debug } = require('../common/log')
const { seq, debounce, throttle, log } = require('../middleware')

const {
  activities,
  edit,
  esper,
  flash,
  history,
  imports,
  intl,
  items,
  keymap,
  lists,
  metadata,
  nav,
  notes,
  notepad,
  ontology,
  photos,
  references,
  project,
  qr,
  selections,
  settings,
  sidebar,
  tags,
  header,
  ui
} = require('../reducers')

const devtools = (ARGS.dev || ARGS.debug) &&
  window.__REDUX_DEVTOOLS_EXTENSION__

module.exports = {
  create(init = {}) {

    let saga = createSagaMiddleware({
      logger,
      onError(error) {
        warn(`unhandled error in saga middleware: ${error.message}`)
        debug(error.stack)
      }
    })

    let reducer = combineReducers({
      activities,
      edit,
      esper,
      flash,
      history,
      imports,
      intl,
      items,
      keymap,
      lists,
      metadata,
      nav,
      notes,
      notepad,
      ontology,
      photos,
      project,
      qr,
      references,
      selections,
      settings,
      sidebar,
      header,
      tags,
      ui
    })

    let middleware = applyMiddleware(
      debounce,
      throttle,
      thunk,
      seq,
      log,
      saga
    )

    if (typeof devtools === 'function') {
      middleware = compose(middleware, devtools())
    }

    return {
      ...createStore(reducer, init, middleware), saga
    }
  }
}
