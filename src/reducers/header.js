'use strict'

const { HEAD } = require('../constants')
const { merge } = require('../common/util')

const init = {
}

module.exports = {
  header(state = init, { type, payload }) {
    switch (type) {
      case HEAD.RESTORE:
        return merge(init, payload)
      case HEAD.PROJECTS_LOADED: {
        return merge(state, payload)
      }
      case HEAD.TASKS_LOADED: {
        return merge(state, payload)
      }
      default:
        return state
    }
  }
}
