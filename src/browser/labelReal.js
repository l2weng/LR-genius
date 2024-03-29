'use strict'

const { EventEmitter } = require('events')
const { resolve } = require('path')

const {
  app, shell, ipcMain: ipc, BrowserWindow, systemPreferences: pref
} = require('electron')

const { info, logger, warn } = require('../common/log')
const { open, hasOverlayScrollBars } = require('./window')
const { all } = require('bluebird')
const { existsSync: exists } = require('fs')
const fs = require('fs')
const { join } = require('path')
const { into, compose, remove, take } = require('transducers.js')
const rm = require('rimraf')
const uuid = require('uuid/v1')

const { AppMenu, ContextMenu } = require('./menu')
const { Cache } = require('../common/cache')
const { Plugins } = require('../common/plugins')
const { Strings } = require('../common/res')
const Storage = require('./storage')
const Updater = require('./updater')
const dialog = require('./dialog')

const { defineProperty: prop } = Object
const act = require('../actions')
const { darwin } = require('../common/os')
const { channel, product, version } = require('../common/release')
const { restrict } = require('../common/util')
const { getLocalIP } = require('../common/serviceUtil')
const { getNewOOSClient, getUrlFilterParams } = require('../common/dataUtil')
const { machineIdSync } = require('node-machine-id')
const { addIdleObserver } = require('./idle')
const axios = require('axios')
const __ = require('underscore')

const {
  FLASH, HISTORY, TAG, PROJECT, CONTEXT, SASS, LOCALE, DATASET, USER
} = require('../constants')

const WIN = SASS.PROJECT
const WIZ = SASS.WIZARD
const ABT = SASS.ABOUT
const PREFS = SASS.PREFS
const RCT = SASS.RECENT
const GDL = SASS.GUIDELINE
const DTS = SASS.DATASET
const USR = SASS.LOGIN

const H = new WeakMap()
const T = new WeakMap()

const ZOOM = { STEP: 0.25, MAX: 2, MIN: 0.75 }


class LabelReal extends EventEmitter {
  static defaults = {
    frameless: darwin,
    debug: false,
    theme: 'light',
    recent: {},
    updater: true,
    webgl: true,
    win: {},
    userInfo: {},
    apiServer: 'http://www.labelreal.com:3000/lr',
    // apiServer: 'http://127.0.0.1:3000/lr',
    projectsCache: {},
    zoom: 1.0
  }

  constructor(opts = {}) {
    super()

    if (LabelReal.instance) { return LabelReal.instance }
    if (!opts.data) { throw new Error('missing data folder') }

    LabelReal.instance = this

    this.opts = opts

    this.menu = new AppMenu(this)
    this.ctx = new ContextMenu(this)
    this.updater = new Updater({
      enable: true
    })

    prop(this, 'cache', {
      value: new Cache(app.getPath('userData'), 'cache')
    })

    prop(this, 'store', { value: new Storage() })

    prop(this, 'projects', { value: new Map() })

    prop(this, 'home', {
      value: resolve(__dirname, '..', '..')
    })

    prop(this, 'plugins', {
      value: new Plugins(join(app.getPath('userData'), 'plugins'))
    })
  }

  async open(file) {
    let { userInfo } = this.state
    if (__.isEmpty(userInfo)) {
      return this.showLogin()
    }

    if (!file) {
      if (this.win) return this.win.show(), this
      if (this.state.recent.hasOwnProperty(this.state.userInfo.user.userId)) {
        for (let recent of this.state.recent[this.state.userInfo.user.userId]) {
          if (!exists(recent)) continue
          file = recent
          break
        }
      }
    }

    let syncFolder = function (newPath, cloudProject) {
      newPath = join(newPath, `project/${cloudProject.fileUuid}`)
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true }, (err) => {
          if (err) throw err
        })
      }
      newPath = join(newPath, `${cloudProject.fileUuid}.lbr`)
      return newPath
    }

    if (!file) {
      const { apiServer } = this.state
      if (this.state.userInfo.hasProject) {
        const ownProject = this.state.userInfo.lastOwnProject
        const cloudProject = this.state.userInfo.lastCloudProject
        const client = getNewOOSClient()
        let newPath = app.getPath('userData')
        if (ownProject) {
          if (fs.existsSync(ownProject.projectFile)) {
            return this.open(ownProject.projectFile)
          } else {
            if (ownProject.syncStatus) {
              newPath = syncFolder(newPath, ownProject)
              const result = await client.get(ownProject.fileUuid, newPath)
              if (result.res.status === 200) return this.open(newPath)
            }
          }
        }
        if (cloudProject) {
          if (fs.existsSync(cloudProject.projectFile)) {
            let query = getUrlFilterParams({ projectId: cloudProject.projectId }, ['projectId'])
            const response = await axios.post(`${apiServer}/graphql?query={projectQueryById${query} { syncVersion fileUuid }}`).catch(err=>{ warn(err) })
            const freshProject = response.data.data
            if (freshProject.projectQueryById.syncVersion !== cloudProject.syncVersion) {
              const result = await client.get(cloudProject.fileUuid, newPath)
              if (result.res.status === 200) return this.open(newPath)
            } else {
              return this.open(cloudProject.projectFile)
            }
          } else {
            newPath = syncFolder(newPath, cloudProject)
            const result = await client.get(cloudProject.fileUuid, newPath)
            if (result.res.status === 200) return this.open(newPath)
          }
        }
      }
      return this.showWizard()
    }

    try {
      file = resolve(file)
      info(`opening ${file}...`)

      if (this.win) {
        if (file) {
          this.dispatch(act.project.open(file), this.win)
        }

        return this.win.show(), this
      }
      this.win = open('project', { file, ...this.hash }, {
        width: WIN.WIDTH,
        height: WIN.HEIGHT,
        minWidth: WIN.MIN_WIDTH * this.state.zoom,
        minHeight: WIN.MIN_HEIGHT * this.state.zoom,
        darkTheme: (this.state.theme === 'dark'),
        frame: !this.hash.frameless
      }, this.state.zoom)

      this.win.on('unresponsive', async () => {
        warn(`win#${this.win.id} has become unresponsive`)

        const chosen = await dialog.show('message-box', this.win, {
          type: 'warning',
          ...this.dict.dialogs.unresponsive
        })

        switch (chosen) {
          case 0:
            return this.win.destroy()
        }
      }).on('close', () => {
        this.state.win.bounds = this.win.getNormalBounds()
      }).on('closed', () => { this.win = undefined })

      this.win.webContents.on('crashed', async () => {
        warn(`win#${this.win.id} contents crashed`)

        const chosen = await dialog.show('message-box', this.win, {
          type: 'warning',
          ...this.dict.dialogs.crashed
        })

        switch (chosen) {
          case 0:
            return this.win.close()
          case 1:
            return this.win.reload()
        }
      })

      if (this.state.win.bounds) {
        this.win.setBounds(this.state.win.bounds)
      }

      return this

    } finally {
      this.emit('app:reload-menu')
    }
  }

  hasOpened({ file, name }) {
    if (this.about) this.about.close()
    if (this.prefs) this.prefs.close()
    if (this.login) this.login.close()
    if (this.recent) this.recent.close()
    if (this.wiz) this.wiz.close()
    this.state.recent[this.state.userInfo.user.userId] =  into(
      [file],
      compose(remove(f => f === file), take(9)),
      this.state.recent[this.state.userInfo.user.userId])

    // if (darwin) this.win.setRepresentedFilename(file)
    if (name) this.win.setTitle(name)

    switch (process.platform) {
      case 'darwin':
      case 'win32':
        app.addRecentDocument(file)
        break
    }

    this.emit('app:reload-menu')
  }

  import() {
    this.dispatch(act.item.import(), this.win)
  }

  showAboutWindow() {
    if (this.about) return this.about.show(), this

    this.about = open('about', this.hash, {
      title: this.dict.windows.about.title,
      width: ABT.WIDTH * this.state.zoom,
      height: ABT.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless
    }, this.state.zoom)
      .once('closed', () => { this.about = undefined })

    return this
  }

  showRecent() {
    if (this.prefs) this.prefs.close()
    if (this.recent) return this.recent.show(), this

    this.recent = open('recent', this.hash, {
      title: this.dict.windows.wizard.title,
      width: RCT.WIDTH * this.state.zoom,
      height: RCT.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless,
    }, this.state.zoom)
    .once('closed', () => { this.recent = undefined })

    return this
  }

  showWizard() {
    if (this.login) this.login.close()
    if (this.prefs) this.prefs.close()
    if (this.gdl) this.gdl.close()
    if (this.wiz) return this.wiz.show(), this

    this.wiz = open('wizard', this.hash, {
      title: this.dict.windows.wizard.title,
      width: WIZ.WIDTH * this.state.zoom,
      height: WIZ.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless,
    }, this.state.zoom)
      .once('closed', () => { this.wiz = undefined })

    return this
  }

  showDataSet() {
    if (this.prefs) this.prefs.close()
    if (this.login) this.login.close()
    if (this.dts) return this.dts.show(), this

    this.dts = open('dataset', this.hash, {
      title: this.dict.windows.wizard.title,
      width: DTS.WIDTH * this.state.zoom,
      height: DTS.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless,
    }, this.state.zoom)
    .once('closed', () => { this.dts = undefined })

    return this
  }

  showLogin() {
    if (this.prefs) this.prefs.close()
    if (this.recent) this.recent.close()
    if (this.login) return this.login.show(), this

    this.login = open('login', this.hash, {
      title: this.dict.windows.wizard.title,
      width: USR.WIDTH * this.state.zoom,
      height: USR.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless,
    }, this.state.zoom)
    .once('closed', () => { this.login = undefined })

    return this
  }

  showGuideline() {
    if (this.prefs) this.prefs.close()
    if (this.gdl) return this.gdl.show(), this

    this.gdl = open('guideline', this.hash, {
      title: this.dict.windows.wizard.title,
      width: GDL.WIDTH * this.state.zoom,
      height: GDL.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless,
    }, this.state.zoom)
    .once('closed', () => { this.gdl = undefined })

    return this
  }

  showPreferences() {
    if (this.prefs) return this.prefs.show(), this

    this.prefs = open('prefs', this.hash, {
      title: this.dict.windows.prefs.title,
      width: PREFS.WIDTH * this.state.zoom,
      height: PREFS.HEIGHT * this.state.zoom,
      parent: darwin ? null : this.win,
      modal: !darwin && !!this.win,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      darkTheme: (this.state.theme === 'dark'),
      frame: !this.hash.frameless
    }, this.state.zoom)
      .once('closed', () => {
        this.prefs = undefined
        this.dispatch(act.ontology.load(), this.win)
        this.dispatch(act.storage.reload([['settings']]), this.win)
      })

    return this
  }

  restore() {
    return all([
      this.store.load('state.json')
    ])
      .then(([state]) => ({ ...LabelReal.defaults, ...state }))
      .catch({ code: 'ENOENT' }, () => LabelReal.defaults)

      .then(state => this.migrate(state))

      .tap(() => all([
        this.load(),
        this.cache.init(),
        this.plugins.init()
      ]))

      .tap(() => this.plugins.watch())
      .tap(state => state.updater && this.updater.start())

      .tap(() => this.emit('app:restored'))
      .tap(() => info('app state restored'))
  }

  load() {
    return all([
      this.menu.load(),
      this.ctx.load(),
      Strings
        .openWithFallback(LOCALE.default, this.state.locale)
        .then(strings => this.strings = strings)
    ])
  }

  migrate(state) {
    state.locale = this.getLocale(state.locale)
    state.version = this.version
    state.uuid = state.uuid || uuid()

    this.state = state
    return this
  }

  persist() {
    info('saving app state')

    if (this.state != null) {
      this.store.save.sync('state.json', this.state)
    }

    return this
  }

  listen() {
    this.on('app:about', () =>
      this.showAboutWindow())

    this.on('app:recent', () =>
      this.showRecent())

    this.on('app:guideline', () =>
      this.showGuideline())

    this.on('app:create-project', () =>{
      this.showWizard()
    })

    this.on('app:close-project', () =>
      this.dispatch(act.project.close(), this.win))

    this.on('app:rebase-project', () =>
      this.dispatch(act.project.rebase(), this.win))

    this.on('app:sync-project-file', () =>
      this.dispatch(act.project.syncProjectFile(), this.win))

    this.on('app:sync-whole-project', (win, { force }) =>
      this.dispatch(act.photo.sync({ cache: this.cache, force: force }),
        win))

    this.on('app:import-photos', () =>
      this.import())

    this.on('app:rename-project', (win) =>
      this.dispatch(act.edit.start({ project: { name: true } }), win))

    this.on('app:show-project-file', () => {
      if (this.state.recent[this.state.userInfo.user.userId].length > 0) {
        shell.showItemInFolder(this.state.recent[this.state.userInfo.user.userId][0])
      }
    })

    this.on('app:show-in-folder', (_, { target }) =>
      shell.showItemInFolder(target.path))

    this.on('app:create-item', () =>
      this.dispatch(act.item.create(), this.win))

    this.on('app:delete-item', (win, { target }) =>
      this.dispatch(act.item.delete(target.id), win))

    this.on('app:merge-item', (win, { target }) =>
      this.dispatch(act.item.merge(target.id), win))

    this.on('app:explode-item', (win, { target }) =>
      this.dispatch(act.item.explode({ id: target.id }), win))

    this.on('app:explode-photo', (win, { target }) => {
      this.dispatch(
        act.item.explode({ id: target.item, photos: [target.id] }),
        win)
    })

    this.on('app:export-item', (win, { target, plugin }) =>
      this.dispatch(act.item.export(target.id, { plugin }), win))

    this.on('app:restore-item', (win, { target }) => {
      this.dispatch(act.item.restore(target.id))
    })

    this.on('app:destroy-item', (win, { target }) => {
      this.dispatch(act.item.destroy(target.id))
    })

    this.on('app:create-item-photo', (win, { target }) => {
      this.dispatch(act.photo.create({ item: target.id }))
    })

    this.on('app:toggle-item-tag', (win, { id, tag }) => {
      this.dispatch(act.item.tags.toggle({ id, tags: [tag] }), win)
    })

    this.on('app:clear-item-tags', (win, { id }) => {
      this.dispatch(act.item.tags.clear(id))
    })

    this.on('app:list-item-remove', (win, { target }) => {
      this.dispatch(act.list.items.remove({
        id: target.list,
        items: target.id
      }), win)
    })

    this.on('app:rename-photo', (win, { target }) =>
      this.dispatch(act.edit.start({ photo: target.id }), win))
    this.on('app:delete-photo', (win, { target }) =>
      this.dispatch(act.photo.delete({
        item: target.item, photos: [target.id]
      }), win))
    this.on('app:duplicate-photo', (win, { target }) =>
      this.dispatch(act.photo.duplicate({
        item: target.item, photos: [target.id]
      }), win))
    this.on('app:consolidate-photo-library', () =>
      this.dispatch(act.photo.consolidate(null, { force: true }), this.win))

    this.on('app:consolidate-photo', (win, { target }) =>
      this.dispatch(act.photo.consolidate([target.id], {
        force: true, prompt: true
      }), win))

    this.on('app:delete-selection', (win, { target }) =>
      this.dispatch(act.selection.delete({
        photo: target.id, selections: [target.selection]
      }), win))

    this.on('app:create-list', (win, { target: parent } = {}) =>
      this.dispatch(act.list.new({ parent }), win))

    this.on('app:rename-list', (win, { target: id }) =>
      this.dispatch(act.edit.start({ list: { id } }), win))

    this.on('app:delete-list', (win, { target }) =>
      this.dispatch(act.list.delete(target), win))

    this.on('app:create-tag', (win) =>
      this.dispatch(act.tag.new(), win))

    this.on('app:rename-tag', (win, { target }) =>
      this.dispatch(act.tag.edit(target), win))

    this.on('app:save-tag', (win, tag) =>
      this.dispatch(act.tag.save(tag), win))

    this.on('app:delete-item-tag', (win, { target }) =>
      this.dispatch(act.item.tags.delete({
        id: target.items, tags: [target.id]
      }), win))

    this.on('app:delete-tag', async (win, { target }) => {
      const chosen = await dialog.show('message-box', this.win, {
        type: 'warning',
        ...this.dict.dialogs.removing
      })
      switch (chosen.response) {
        case 0:
          this.dispatch(act.tag.delete(target.id), win)
      }
    })

    this.on('app:create-note', (win, { target }) =>
      this.dispatch(act.note.create(target), win))

    this.on('app:delete-note', (win, { target }) =>
      this.dispatch(act.note.delete(target), win))

    this.on('app:toggle-line-wrap', (win, { target }) =>
      this.dispatch(act.notepad.update({
        [target.id]: { wrap: !target.wrap }
      }), win))
    this.on('app:toggle-line-numbers', (win, { target }) =>
      this.dispatch(act.notepad.update({
        [target.id]: { numbers: !target.numbers }
      }), win))
    this.on('app:writing-mode', (win, { id, mode }) =>
      this.dispatch(act.notepad.update({ [id]: { mode  } }), win))

    this.on('app:toggle-menu-bar', win => {
      if (win.isMenuBarAutoHide()) {
        win.setAutoHideMenuBar(false)
      } else {
        win.setAutoHideMenuBar(true)
        win.setMenuBarVisibility(false)
      }
    })

    this.on('app:clear-recent-projects', () => {
      info('clearing recent projects...')
      this.state.recent[this.state.userInfo.user.userId] = []
      this.emit('app:reload-menu')
    })

    this.on('app:switch-theme', (_, theme) => {
      info(`switching to "${theme}" theme...`)
      this.state.theme = theme
      this.broadcast('theme', theme)
      this.emit('app:reload-menu')
    })

    this.on('app:switch-locale', async (_, locale) => {
      info(`switching to "${locale}" locale...`)
      this.state.locale = locale
      await this.load()
      this.updateWindowLocale()
      this.emit('app:reload-menu')
    })

    this.on('app:toggle-debug-flag', () => {
      info('toggling dev/debug mode...')
      this.state.debug = !this.state.debug
      this.broadcast('debug', this.state.debug)
      this.emit('app:reload-menu')
    })

    this.on('app:check-for-updates', () => {
      this.updater.check()
    })

    this.on('app:install-updates', () => {
      this.updater.install()
    })

    this.on('app:reload-menu', () => {
      // Note: there may be Electron issues when reloading
      // the main menu. But since we cannot remove items
      // dynamically (#527) this is our only option.
      this.menu.reload()
    })

    this.on('app:undo', (win) => {
      if (this.getHistory(win || this.win).past) {
        this.dispatch({
          type: HISTORY.UNDO,
          meta: { ipc: HISTORY.CHANGED }
        }, win || this.win)
      }
    })

    this.on('app:redo', (win) => {
      if (this.getHistory(win || this.win).future) {
        this.dispatch({
          type: HISTORY.REDO,
          meta: { ipc: HISTORY.CHANGED }
        }, win || this.win)
      }
    })

    this.on('app:inspect', (win, { x, y }) => {
      if (win != null) win.webContents.inspectElement(x, y)
    })

    this.on('app:open-preferences', () => {
      this.showPreferences()
    })

    this.on('app:open-license', () => {
      shell.openExternal('https://labelreal.org/license')
    })

    this.on('app:search-issues', () => {
      shell.openExternal('https://github.com/labelreal/labelreal/issues')
    })

    this.on('app:open-docs', () => {
      shell.openExternal('https://docs.labelreal.org')
    })

    this.on('app:open-forums', () => {
      shell.openExternal('https://forums.labelreal.org')
    })

    this.on('app:open-logs', () => {
      shell.showItemInFolder(this.log)
    })

    this.on('app:open-user-data', () => {
      shell.showItemInFolder(join(app.getPath('userData'), 'state.json'))
    })

    this.on('app:open-plugins-folder', () => {
      shell.showItemInFolder(this.plugins.configFile)
    })

    this.on('app:install-plugin', async (win) => {
      const plugins = await dialog.show('file', darwin ? null : win, {
        defaultPath: app.getPath('downloads'),
        filters: [{ name: 'LabelReal Plugin', extensions: Plugins.ext }],
        properties: ['openFile']
      })

      if (plugins != null) await this.plugins.install(...plugins)
    })

    this.on('app:reset-ontology-db', () => {
      if (this.win || this.prefs) {
        this.dispatch(act.ontology.reset())
      } else {
        rm.sync(join(app.getPath('userData'), 'ontology.db'))
      }
    })

    this.on('app:open-dialog', (win, options = {}) => {
      dialog
        .show('file', win, {
          ...options,
          defaultPath: app.getPath('documents'),
          filters: [{ name: 'LabelReal Projects', extensions: ['lbr'] }],
          properties: ['openFile']

        }).then(files => {
          if (files) this.open(...files)
        })
    })

    this.on('app:zoom-in', () => {
      this.zoom(this.state.zoom + ZOOM.STEP)
    })

    this.on('app:zoom-out', () => {
      this.zoom(this.state.zoom - ZOOM.STEP)
    })

    this.on('app:zoom-reset', () => {
      this.zoom(1.0)
    })

    this.plugins.on('change', () => {
      this.broadcast('plugins-reload')
      this.emit('app:reload-menu')
    })

    let quit = false
    let winId

    app.on('browser-window-focus', (_, win) => {
      try {
        if (winId !== win.id) this.emit('app:reload-menu')
      } finally {
        winId = win.id
      }
    })

    app.once('before-quit', () => { quit = true })

    app.on('window-all-closed', () => {
      if (quit || !darwin) app.quit()
    })

    app.on('quit', () => {
      this.updater.stop()
      this.plugins.stop()
      this.persist()
    })

    if (darwin) {
      app.on('activate', () => this.open())

      const ids = [
        pref.subscribeNotification(
          'AppleShowScrollBarsSettingChanged', () =>
            this.broadcast('scrollbars', !hasOverlayScrollBars()))
      ]

      app.on('quit', () => {
        for (let id of ids) pref.unsubscribeNotification(id)
      })
    }

    ipc.on('cmd', (event, command, ...params) => {
      this.emit(command, BrowserWindow.fromWebContents(event.sender), ...params)
    })

    ipc.on(PROJECT.OPENED, (_, project) => this.hasOpened(project))

    ipc.on(PROJECT.CREATE, () => {
      if (this.gdl) this.gdl.close()
      this.showWizard()
    })

    ipc.on(PROJECT.CREATED, (_, { file, name }) => {
      let { userInfo, apiServer } = this.state
      axios.post(`${apiServer}/projects/create`, {
        userId: __.isEmpty(userInfo) ? '' : userInfo.user.userId,
        machineId: machineIdSync({ original: true }),
        creator: __.isEmpty(userInfo) ? '' : userInfo.user.name,
        creatorId: __.isEmpty(userInfo) ? '' : userInfo.user.userId,
        projectFile: file,
        name,
      }).then(function () {
        info('sync new project to cloud')
      }).catch(function (error) {
        warn(error)
      })
      return this.open(file)
    })

    ipc.on(DATASET.CREATE, () => {
      this.showDataSet()
    })

    ipc.on(USER.LOGIN, () => {
      this.showLogin()
    })

    ipc.on(USER.LOGOUT, () => {
      this.state.userInfo = {}
      this.store.save.sync('state.json', this.state)
      this.showLogin()
      if (this.win) this.win.close()
    })

    ipc.on('win-reload', ()=>{
      let win = BrowserWindow.getFocusedWindow()
      win.webContents.send('reload')
    })

    ipc.on(USER.LOGINED, (_, { data }) => {
      data.ip = getLocalIP()
      this.state.userInfo = data
      if (!this.state.recent.hasOwnProperty(this.state.userInfo.user.userId)) {
        this.state.recent[this.state.userInfo.user.userId] = []
      }
      this.store.save.sync('state.json', this.state)
      return this.open()
    })

    ipc.on(PROJECT.PROJECTS_CACHE, (_, data) => {
      this.state.projectsCache = data
      this.store.save.sync('state.json', this.state)
    })

    ipc.on(FLASH.HIDE, (_, { id, confirm }) => {
      if (id === 'update.ready' && confirm) {
        this.updater.install()
      }
    })

    ipc.on(PROJECT.UPDATE, (_, { name }) => {
      if (name) this.win.setTitle(name)
    })

    ipc.on(HISTORY.CHANGED, (event, history) => {
      this.setHistory(history, BrowserWindow.fromWebContents(event.sender))
      this.emit('app:reload-menu')
    })

    ipc.on(TAG.CHANGED, (event, tags) => {
      this.setTags(tags, BrowserWindow.fromWebContents(event.sender))
      this.emit('app:reload-menu')
    })

    ipc.on(CONTEXT.SHOW, (event, payload) => {
      this.ctx.show(payload, BrowserWindow.fromWebContents(event.sender))
    })

    dialog.start()
    this.updater
    .on('checking-for-updates', () => {
      this.emit('app:reload-menu')
    })
    .on('update-not-available', () => {
      this.emit('app:reload-menu')
    })
    .on('update-ready', (release) => {
      this.broadcast('dispatch', act.flash.show(release))
    })

    app.whenReady().then(() => {
      addIdleObserver((_, type, time) => {
        this.broadcast('idle', { type, time })
      }, 60)
    })
    return this
  }

  get hash() {
    return {
      environment: process.env.NODE_ENV,
      debug: this.debug,
      dev: this.dev,
      home: app.getPath('userData'),
      user: app.getPath('home'),
      documents: app.getPath('documents'),
      pictures: app.getPath('pictures'),
      cache: this.cache.root,
      plugins: this.plugins.root,
      frameless: this.state.frameless,
      theme: this.state.theme,
      locale: this.state.locale,
      log: this.log,
      level: logger.level,
      uuid: this.state.uuid,
      update: this.updater.release,
      recent: this.state.recent,
      userInfo: this.state.userInfo,
      machineId: machineIdSync({ original: true }),
      apiServer: this.state.apiServer,
      projectsCache: this.state.projectsCache,
      version,
      webgl: this.state.webgl
    }
  }

  zoom(factor) {
    this.state.zoom = restrict(factor, ZOOM.MIN, ZOOM.MAX)

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.setZoomFactor(this.state.zoom)
    }
  }

  updateWindowLocale() {
    const { dict, about, prefs, wiz } = this
    if (about != null) about.setTitle(dict.windows.about.title)
    if (prefs != null) prefs.setTitle(dict.windows.prefs.title)
    if (wiz != null) wiz.setTitle(dict.windows.wizard.title)
    this.broadcast('locale', this.state.locale)
  }

  dispatch(action, win = BrowserWindow.getFocusedWindow()) {
    if (win != null) {
      win.webContents.send('dispatch', action)
    }
  }

  broadcast(...args) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(...args)
    }
  }

  getLocale(locale) {
    return LOCALE[locale || app.getLocale()] || LOCALE.default
  }

  getHistory(win = BrowserWindow.getFocusedWindow()) {
    return H.get(win) || {}
  }

  setHistory(history, win = BrowserWindow.getFocusedWindow()) {
    return H.set(win, history)
  }

  getTags(win = BrowserWindow.getFocusedWindow()) {
    return T.get(win) || []
  }

  setTags(tags, win = BrowserWindow.getFocusedWindow()) {
    return T.set(win, tags)
  }


  get defaultLocale() {
    return this.getLocale()
  }

  get dict() {
    return this.strings.dict
  }

  get name() {
    return product
  }

  get dev() {
    return channel === 'dev' || process.env.NODE_ENV === 'development'
  }

  get log() {
    return join(app.getPath('logs'), 'labelreal.log')
  }

  get debug() {
    return this.opts.debug || this.state.debug
  }

  get version() {
    return version
  }
}

module.exports = LabelReal
