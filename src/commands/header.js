'use strict'

const { put, select } = require('redux-saga/effects')
const { Command } = require('./command')
const { HEAD } = require('../constants')
const { remote } = require('electron')
const act = require('../actions')
const fs = require('fs')
const axios = require('axios')
const { getUrlFilterParams, getNewOOSClient } = require('../common/dataUtil')
const { join } = require('path')
const { apiServer } = ARGS
const { error } = require('../common/log')
const args = require('../args')

class LoadProjects extends Command {
  static get ACTION() { return HEAD.PROJECTS }

  * exec() {
    const { typeFlag, id } = this.action.payload
    let { projectsCache } = ARGS
    let query
    query = typeFlag ?
      getUrlFilterParams({ userId: id }, ['userId']) :
      getUrlFilterParams({ machineId: id }, ['machineId'])
    let projects = []
    let { project } = yield select()
    try {
      let response = yield axios.get(
        `${apiServer}/graphql?query={projectQueryByUser${query} { projectId name desc deadline projectFile type progress cover itemCount syncStatus syncCover remoteProjectFile localProjectId syncProjectFileName syncProjectFile syncProjectSize syncVersion isOwner fileUuid } } `)
      if (response.status === 200) {
        projects = response.data.data.projectQueryByUser
        const app = remote.app
        const client = getNewOOSClient()
        for (let i = 0; i < projects.length; i++) {
          const cloudProject = projects[i]
          if (cloudProject.fileUuid !== project.fileUuid) {
            let newPath = join(app.getPath('userData'), `project/${cloudProject.fileUuid}`)
            //if project file is his own
            if (!fs.existsSync(cloudProject.projectFile) &&
              cloudProject.syncStatus) {
              if (!fs.existsSync(newPath)) {
                fs.mkdir(newPath, { recursive: true }, (err) => {
                  if (err) throw err
                })
              }
              newPath = join(newPath, `${cloudProject.fileUuid}.lbr`)
              if (!fs.existsSync(newPath) ||
                projectsCache[cloudProject.projectId] !==
                cloudProject.syncVersion) {
                yield client.get(cloudProject.fileUuid, newPath)
                projectsCache[cloudProject.projectId] = cloudProject.syncVersion
                args.update({ ...projectsCache })
                yield put(act.project.cacheProjects(projectsCache))
              }
              cloudProject.projectFile = newPath
            }
          }
        }
      }
      yield put(act.header.projectsLoaded({ projects }))
    } catch (err) {
      error(err.toString())
    }
  }
}

class LoadMyTasks extends Command {
  static get ACTION() { return HEAD.TASKS }

  * exec() {
    let { userId, type } = this.action.payload
    let query = getUrlFilterParams({ userId: userId, type: type }, ['userId', 'type'])
    let tasks = []
    try {
      let response = yield axios.get(
        `${apiServer}/graphql?query={taskQuery${query}  { taskId key:taskId name isOwner type category localTaskId progress projectId updatedAt workStatus project { projectId name deadline creator creatorId } }} `)
      if (response.status === 200) {
        tasks = response.data.data.taskQuery
      }
      yield put(act.header.tasksLoaded({ tasks }))
    } catch (err) {
      error(err.toString())
    }
  }
}


class Load extends Command {
  static get ACTION() { return HEAD.LOAD }

  *exec() {
    const { userInfo } = ARGS
    yield put(act.header.loadProjects({ typeFlag: true, id: userInfo.user.userId }))
    yield put(act.header.loadMyTasks({ userId: userInfo.user.userId, type: HEAD.MY_TASKS }))
  }
}

module.exports = {
  LoadProjects,
  LoadMyTasks,
  Load
}
