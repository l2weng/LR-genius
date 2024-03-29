'use strict'

const { call, put, select, all } = require('redux-saga/effects')
const { Command } = require('./command')
const { pluck, splice, warp } = require('../common/util')
const { LIST } = require('../constants')

const actions = require('../actions/list')
const sActions = require('../actions/selection')
const actionsHeader = require('../actions/header')
const mod = require('../models/list')
const { ipcRenderer: ipc  } = require('electron')
const axios = require('axios')
const { userInfo } = ARGS

class Load extends Command {
  static get ACTION() { return LIST.LOAD }

  *exec() {
    const { db } = this.options
    const { payload } = this.action
    const { project } = payload
    const isOwner = project.owner === userInfo.user.userId
    let listResult = {}
    if (isOwner) { listResult =  yield call(mod.all, db) } else { listResult = yield call(mod.loadMyList, db) }
    let syncTaskIds = []
    for (const key of Object.keys(listResult)) {
      if (listResult[key].syncTaskId != null) {
        syncTaskIds.push(listResult[key].syncTaskId)
      }
    }
    const cloudTasks = yield axios.post(`${ARGS.apiServer}/tasks/loadTasks`, { taskIds: syncTaskIds })
    for (const key of Object.keys(listResult)) {
      for (const cloudTask of cloudTasks.data.obj) {
        if (listResult[key].syncTaskId === cloudTask.taskId) {
          listResult[key].progress = cloudTask.progress
          listResult[key].workStatus = cloudTask.workStatus
        }
      }
    }
    if (isOwner) {
      yield put(sActions.loadFromCloud({ listResult: listResult }))
    }
    return listResult
  }
}

class SubmitTask extends Command {
  static get ACTION() { return LIST.SUBMIT_TASK }

  *exec() {
    const { payload } = this.action
    const { id, syncTaskId, workStatus, taskType } = payload
    const updateResult = yield axios.post(`${ARGS.apiServer}/tasks/updateUserTaskStatus`, { taskId: syncTaskId, userId: userInfo.user.userId, workStatus })
    if (updateResult.data.result === 'success') {
      yield put(actionsHeader.loadMyTasks({ userId: userInfo.user.userId, type: taskType }))
      yield put(actions.update({ id, syncTaskId, workStatus }))
    }
  }
}

class UpdateOwner extends Command {
  static get ACTION() { return LIST.UPDATE_OWNER }

  *exec() {
    const { payload } = this.action
    const { workers, syncTaskId, id } = payload
    const { db } = this.options
    yield call(mod.updateOwner, db, { workers: JSON.stringify(workers), syncTaskId })
    return { id, syncTaskId, workers }
  }
}


class Create extends Command {
  static get ACTION() { return LIST.CREATE }

  *exec() {
    const { payload } = this.action
    const { db } = this.options
    const { name, parent, syncProjectId } = payload

    const { children } = yield select(state => state.lists[parent])
    const idx = children.length

    let list = yield call(mod.create, db, { name, parent, position: idx + 1 })

    yield put(actions.insert(list, { idx }))
    const createResult = yield axios.post(`${ARGS.apiServer}/tasks/create`, { localTaskId: list.id, name: list.name, projectId: syncProjectId, userId: userInfo.user.userId })
    let syncTaskId
    if (createResult.status === 200) {
      syncTaskId = createResult.data.obj.taskId
    }
    list.syncTaskId = syncTaskId
    yield all([
      call(mod.update, db, { syncTaskId, id: list.id }),
    ])
    this.undo = actions.delete(list.id)
    this.redo = actions.restore(list, { idx })
    return list
  }
}

class Save extends Command {
  static get ACTION() { return LIST.SAVE }

  *exec() {
    const { payload } = this.action
    const { db } = this.options

    this.original = yield select(state => state.lists[payload.id])

    yield put(actions.update(payload))
    yield call(mod.save, db, payload)
    if (this.original.name !== payload.name) {
      yield axios.post(`${ARGS.apiServer}/tasks/update`, { name: payload.name, taskId: this.original.syncTaskId })
      ipc.send('cmd', 'app:sync-project-file')
    }
    this.undo = actions.save(this.original)
  }

  *abort() {
    if (this.original) {
      yield put(actions.update(this.original))
    }
  }
}


class Delete extends Command {
  static get ACTION() { return LIST.DELETE }

  *exec() {
    const { payload } = this.action
    const { id, syncTaskId } = payload
    const { db } = this.options
    const { lists } = yield select()

    const original = lists[id]
    const parent = lists[original.parent]

    const idx = parent.children.indexOf(id)
    const cid = splice(parent.children, idx, 1)

    yield call(db.transaction, async tx => {
      await mod.remove(tx, id)
      await mod.order(tx, parent.id, cid)
    })

    yield put(actions.remove(id))
    yield axios.post(`${ARGS.apiServer}/tasks/remove`, { taskId: syncTaskId })

    ipc.send('cmd', 'app:sync-project-file')
    this.undo = actions.restore(original, { idx })

    return [original, idx]
  }
}


class Restore extends Command {
  static get ACTION() { return LIST.RESTORE }

  *exec() {
    const { db } = this.options
    const { idx } = this.action.meta
    const list = this.action.payload

    const { children } = yield select(state => state.lists[list.parent])
    const cid = splice(children, idx, 0, list.id)

    yield call(db.transaction, async tx => {
      await mod.restore(tx, list.id, list.parent)
      await mod.order(tx, list.parent, cid)
    })

    yield put(actions.insert(list, { idx }))

    ipc.send('cmd', 'app:sync-project-file')
    yield axios.post(`${ARGS.apiServer}/tasks/revert`, { taskId: list.syncTaskId })

    this.undo = actions.delete(list.id)
  }
}

class Move extends Command {
  static get ACTION() { return LIST.MOVE }

  *exec() {
    let { db } = this.options
    let list = this.action.payload
    let to = this.action.meta.idx
    let idx

    let [original, parent] = yield select(state =>
      pluck(state.lists, [list.id, list.parent]))

    if (parent.id === original.parent) {
      idx = parent.children.indexOf(list.id)
      let children = warp(parent.children, idx, to)

      yield call(mod.order, db, parent.id, children)
      yield put(actions.update({ id: parent.id, children }))

    } else {
      let oldParent = yield select(state => state.lists[original.parent])
      idx = oldParent.children.indexOf(list.id)

      let oldChildren = splice(oldParent.children, idx, 1)
      let children = splice(parent.children, to, 0, list.id)

      yield call(db.transaction, async tx => {
        await mod.save(tx, { id: list.id, parent_list_id: parent.id })
        await mod.order(tx, parent.id, children)
        await mod.order(tx, oldParent.id, oldChildren)
      })

      yield put(actions.update([
        { id: oldParent.id, children: oldChildren },
        { id: list.id, parent: parent.id },
        { id: parent.id, children }
      ]))
    }

    ipc.send('cmd', 'app:sync-project-file')
    this.undo = actions.move({ id: list.id, parent: original.parent }, { idx })
    return list
  }
}

class AddItems extends Command {
  static get ACTION() { return LIST.ITEM.ADD }

  *exec() {
    let { db } = this.options
    let { id, items } = this.action.payload

    let res = yield call(db.transaction, tx =>
      mod.items.add(tx, id, items))

    ipc.send('cmd', 'app:sync-whole-project', { force: false })
    this.undo = actions.items.remove({ id, items: res.items })
    this.redo = actions.items.restore({ id, items: res.items })

    return { id, items: res.items }
  }
}

class RemoveItems extends Command {
  static get ACTION() { return LIST.ITEM.REMOVE }

  *exec() {
    let { db } = this.options
    let { id, items } = this.action.payload

    yield call(mod.items.remove, db, id, items)

    this.undo = actions.items.restore({ id, items })

    return { id, items }
  }
}

class RestoreItems extends Command {
  static get ACTION() { return LIST.ITEM.RESTORE }

  *exec() {
    let { db } = this.options
    let { id, items } = this.action.payload

    yield call(mod.items.restore, db, id, items)

    this.undo = actions.items.remove({ id, items })

    return { id, items }
  }
}


module.exports = {
  Create,
  Delete,
  UpdateOwner,
  Load,
  Restore,
  Save,
  Move,
  SubmitTask,
  AddItems,
  RemoveItems,
  RestoreItems
}
