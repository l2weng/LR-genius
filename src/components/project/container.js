'use strict'

const React = require('react')
const { Component } = React
const { connect } = require('react-redux')
const { ProjectView } = require('./view')
const { ItemView } = require('../item')
const { DragLayer } = require('../drag-layer')
const { DropTarget } = require('react-dnd')
const { ipcRenderer: ipc  } = require('electron')
const { NativeTypes } = require('react-dnd-electron-backend')
const { NoProject } = require('./none')
const { extname } = require('path')
const { MODE } = require('../../constants/project')
const { DATASET, USER } = require('../../constants')
const { emit, on, off, ensure, reflow } = require('../../dom')
const { win } = require('../../window')
const cx = require('classnames')
const { values } = Object
const actions = require('../../actions')
const debounce = require('lodash.debounce')
const { match } = require('../../keymap')
const { IconSpin } = require('../icons')
const { userInfo } = ARGS

const {
  getCachePrefix,
  getAllColumns,
  getExpandedPhotos,
  getSelectedItems,
  getSelectedPhoto,
  getSelectedNote,
  getSortColumn,
  getVisibleItems,
  getVisibleNotes,
  getVisiblePhotos,
  getVisibleAllPhotos
} = require('../../selectors')

const {
  arrayOf, oneOf, shape, bool, object, func, string, number, array
} = require('prop-types')


class ProjectContainer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isClosed: props.project.closed != null,
      isClosing: this.isClosing(props),
      mode: props.nav.mode,
      offset: props.ui.panel.width,
      forceFlush: false,
      willModeChange: false,
      isModeChanging: false
    }
  }

  componentDidMount() {
    on(document, 'keydown', this.handleKeyDown)
  }

  componentWillUnmount() {
    this.projectWillChange.cancel()
    off(document, 'keydown', this.handleKeyDown)
  }

  componentWillReceiveProps({ nav, project, ui }) {
    if (nav.mode !== this.props.nav.mode) {
      this.modeWillChange()
    }

    if (this.props.ui.panel !== ui.panel) {
      this.setState({ offset: ui.panel.width })
    }

    if (project !== this.props.project) {
      this.projectWillChange(project)
    }
  }

  get classes() {
    const { isOver, canDrop, nav } = this.props
    const { isClosing, mode, willModeChange, isModeChanging } = this.state

    return ['project', {
      closing: isClosing,
      empty: this.isEmpty,
      over: isOver && canDrop,
      [`${mode}-mode`]: true,
      [`${mode}-mode-leave`]: willModeChange,
      [`${mode}-mode-leave-active`]: isModeChanging,
      [`${nav.mode}-mode-enter`]: willModeChange,
      [`${nav.mode}-mode-enter-active`]: isModeChanging
    }]
  }

  isClosing({ project } = this.props) {
    return !!(project.closing && project.id != null)
  }

  get isEmpty() {
    return this.props.project.id != null &&
      this.props.project.items === 0
  }

  modeWillChange() {
    if (this.state.willModeChange) return

    this.setState({ willModeChange: true, isModeChanging: false }, () => {
      reflow(this.container)

      requestAnimationFrame(() => {
        this.setState({ isModeChanging: true })
        ensure(
          this.container,
          'transitionend',
          this.modeDidChange,
          3000,
          this.isMainView)
      })
    })
  }

  modeDidChange = () => {
    this.setState({
      mode: this.props.nav.mode,
      willModeChange: false,
      isModeChanging: false
    })
    if (this.props.nav.mode === MODE.PROJECT && this.state.forceFlush) {
      this.props.onProjectFlush(this.props.project)
      this.setState({ forceFlush: false })
    }
  }

  projectWillChange = debounce(project => {
    this.setState({
      isClosing: this.isClosing({ project }),
      isClosed: (project.closed != null)
    })
  }, 750, { leading: false })

  isMainView = (event) => {
    return event.target.parentNode === this.container
  }

  handleContextMenu = (event) => {
    this.props.onContextMenu(event)
  }

  handleModeChange = (mode) => {
    this.props.onModeChange(mode)
  }

  handlePanelResize = (offset) => {
    this.setState({ offset })
  }

  handleLabelSync = (args) =>{
    if (!this.state.forceFlush) {
      this.setState({ forceFlush: true })
    }
    this.props.onLabelSync(args)
  }

  handleLabelSkip = (args) =>{
    if (!this.state.forceFlush) {
      this.setState({ forceFlush: true })
    }
    this.props.onLabelSkip(args)
  }

  handlePanelDragStop = () => {
    this.props.onUiUpdate({
      panel: { width: Math.round(this.state.offset) }
    })
  }

  handleMetadataSave = (payload, meta = {}) => {
    const { sort, onMetadataSave } = this.props
    if (sort.column in payload.data) {
      meta.search = true
    }

    onMetadataSave(payload, meta)
  }

  handleSyncProject2Cloud = () => {
    ipc.send('cmd', 'app:sync-whole-project', { force: false })
  }

  handleSkuSave = (data) => {
    const { project } = this.props
    this.props.onSkuSave({ ...data }, project )
  }

  handleKeyDown = (event) => {
    switch (match(this.props.keymap.global, event)) {
      case 'back':
        if (this.state.mode !== MODE.PROJECT) {
          this.handleModeChange(MODE.PROJECT)
        }
        break
      case 'nextItem':
        emit(document, 'global:next-item')
        break
      case 'prevItem':
        emit(document, 'global:prev-item')
        break
      case 'nextPhoto':
        emit(document, 'global:next-photo')
        break
      case 'prevPhoto':
        emit(document, 'global:prev-photo')
        break
      default:
        return
    }

    event.stopPropagation()
    event.preventDefault()
  }

  setContainer = (container) => {
    this.container = container
  }

  renderNoProject() {
    return (
      <NoProject
        connect={this.props.dt}
        canDrop={this.props.canDrop}
        isOver={this.props.isOver}
        onProjectCreate={this.props.onProjectCreate}
        onToolbarDoubleClick={this.props.onMaximize}/>
    )
  }
  render() {
    if (this.state.isClosed) return this.renderNoProject()
    const {
      columns,
      data,
      dt,
      expanded,
      items,
      nav,
      note,
      notes,
      photo,
      photos,
      visibleAllPhotos,
      selection,
      selections,
      ui,
      references,
      project,
      ...props
    } = this.props
    const isOwner = project.owner === userInfo.user.userId
    const mainProject = dt(
      <div style={{ height: '100%' }}
        className={cx(this.classes)}
        ref={this.setContainer}
        onContextMenu={this.handleContextMenu} >
        <ProjectView {...props}
          nav={nav}
          items={items}
          data={data}
          isActive={this.state.mode === MODE.PROJECT && !this.isClosing()}
          isEmpty={this.isEmpty}
          columns={columns}
          offset={this.state.offset}
          photos={photos}
          zoom={ui.zoom}
          isOwner={isOwner}
          onSkuSave={this.handleSkuSave}
          onSyncProject2Cloud={this.handleSyncProject2Cloud}
          onMetadataSave={this.handleMetadataSave}/>

        <ItemView {...props}
          items={selection}
          data={data}
          expanded={expanded}
          activeSelection={nav.selection}
          selections={selections}
          note={note}
          notes={notes}
          references={references}
          enableReference={nav.enableReference || false}
          photo={photo}
          nav={nav}
          isOwner={isOwner}
          photos={visibleAllPhotos}
          panel={ui.panel}
          offset={this.state.offset}
          mode={this.state.mode}
          isModeChanging={this.state.isModeChanging}
          isTrashSelected={!!nav.trash}
          isProjectClosing={this.isClosing()}
          onLabelSync={this.handleLabelSync}
          onLabelSkip={this.handleLabelSkip}
          onPanelResize={this.handlePanelResize}
          onPanelDragStop={this.handlePanelDragStop}
          onMetadataSave={this.handleMetadataSave}/>

        <DragLayer
          cache={props.cache}
          photos={photos}
          tags={props.tags}
          onPhotoError={props.onPhotoError}/>
        <div className="closing-backdrop">
          <IconSpin/>
        </div>
      </div>)
    return mainProject
  }


  static propTypes = {
    expanded: arrayOf(object).isRequired,
    project: shape({
      file: string
    }).isRequired,

    keymap: object.isRequired,
    items: arrayOf(
      shape({ id: number.isRequired })
    ).isRequired,

    selection: arrayOf(
      shape({ id: number.isRequired })
    ),
    selections: object.isRequired,

    photo: object,
    photos: object.isRequired,
    visiblePhotos: arrayOf(
      shape({ id: number.isRequired })
    ),
    visibleAllPhotos: arrayOf(
      shape({ id: number.isRequired })
    ),

    note: shape({ id: number.isRequired }),
    notes: arrayOf(
      shape({ id: number.isRequired })
    ),
    references: array,
    nav: shape({
      mode: oneOf(values(MODE)).isRequired
    }).isRequired,

    ui: object.isRequired,
    data: object.isRequired,
    columns: object.isRequired,
    cache: string.isRequired,
    sort: object.isRequired,
    tags: object.isRequired,

    isOver: bool,
    canDrop: bool,
    dt: func.isRequired,

    onContextMenu: func.isRequired,
    onPhotoError: func.isRequired,
    onProjectCreate: func.isRequired,
    onProjectFlush: func.isRequired,
    onProjectOpen: func.isRequired,
    onMaximize: func.isRequired,
    onModeChange: func.isRequired,
    onHandleLogin: func.isRequired,
    onMetadataSave: func.isRequired,
    onItemTagsAdd: func.isRequired,
    onSyncProject2Cloud: func.isRequired,
    onSort: func.isRequired,
    onSkuSave: func.isRequired,
    onTemplateImport: func.isRequired,
    onUiUpdate: func.isRequired
  }
}


const DropTargetSpec = {
  drop({ onProjectOpen, onTemplateImport, project }, monitor) {
    let files = monitor.getItem().files.map(f => f.path)

    switch (extname(files[0])) {
      case '.lbr':
        files = files.slice(0, 1)
        if (files[0] !== project.file) {
          onProjectOpen(files[0])
        }
        break
      case '.ttp':
        files = files.filter(f => f.endsWith('.ttp'))
        onTemplateImport(files)
        break
      default:
        files = []
    }

    return { files }
  },

  canDrop({ project }, monitor) {
    const { types } = monitor.getItem()

    if (types.length < 1) return false

    switch (types[0]) {
      case 'application-vnd.labelreal.lbr':
        return project.closed //|| files[0].path !== project.file
      case 'application-vnd.labelreal.ttp':
        return true
      default:
        return false
    }
  }
}


module.exports = {
  ProjectContainer: connect(
    state => ({
      cache: getCachePrefix(state),
      columns: getAllColumns(state),
      data: state.metadata,
      edit: state.edit,
      expanded: getExpandedPhotos(state),
      index: state.qr.index,
      items: getVisibleItems(state),
      keymap: state.keymap,
      nav: state.nav,
      note: getSelectedNote(state),
      notes: getVisibleNotes(state),
      photo: getSelectedPhoto(state),
      photos: state.photos,
      references: state.references,
      visiblePhotos: getVisiblePhotos(state),
      visibleAllPhotos: getVisibleAllPhotos(state),
      project: state.project,
      properties: state.ontology.props,
      selection: getSelectedItems(state),
      selections: state.selections,
      sort: getSortColumn(state),
      tags: state.tags,
      ui: state.ui,
      tasks: state.header.tasks || []
    }),

    dispatch => ({
      onMaximize() {
        win.maximize()
      },

      onContextMenu(event, ...args) {
        event.stopPropagation()
        dispatch(actions.context.show(event, ...args))
      },

      onModeChange(mode) {
        dispatch(actions.nav.update({ mode }))
      },

      onHandleLogin() {
        ipc.send(USER.LOGIN)
      },

      onOpenInFolder(...args) {
        dispatch(actions.shell.openInFolder(args))
      },

      onProjectCreate() {
        dispatch(actions.project.create())
      },

      onProjectFlush(project) {
        dispatch(actions.list.load({ project }))
      },

      onProjectOpen(path) {
        dispatch(actions.project.open(path))
      },

      onLabelSync(...args) {
        dispatch(actions.photo.syncLabel(...args))
      },

      onLabelSkip(...args) {
        dispatch(actions.photo.skipLabel(...args))
      },

      onColumnInsert(...args) {
        dispatch(actions.nav.column.insert(...args))
      },

      onColumnRemove(...args) {
        dispatch(actions.nav.column.remove(...args))
      },

      onColumnOrder(...args) {
        dispatch(actions.nav.column.order(...args))
      },

      onColumnResize(...args) {
        dispatch(actions.nav.column.resize(...args))
      },

      onSelect(...args) {
        dispatch(actions.nav.select(...args))
      },

      onSearch(query) {
        dispatch(actions.nav.search({ query }))
      },

      onSort(...args) {
        dispatch(actions.nav.sort(...args))
      },

      onItemSelect(payload, mod, meta) {
        dispatch(actions.item.select(payload, { mod, ...meta }))
      },

      onItemOpen(item) {
        dispatch(actions.item.open(item))
      },

      onItemCreate() {
        dispatch(actions.item.create())
      },

      onDataSetsCreate() {
        ipc.send(DATASET.CREATE)
      },

      onItemSave(...args) {
        dispatch(actions.item.save(...args))
      },

      onItemImport(...args) {
        dispatch(actions.item.import(...args))
      },

      onItemExport(items, meta) {
        dispatch(actions.item.export(items, meta))
      },

      onItemDelete(items) {
        dispatch(actions.item.delete(items))
      },

      onItemTagsAdd(...args) {
        dispatch(actions.item.tags.assign(...args))
      },

      onItemMerge(...args) {
        //todo disable merge temporally
        // dispatch(actions.item.merge(...args))
      },

      onItemPreview(...args) {
        dispatch(actions.item.preview(...args))
      },

      onItemTagAdd(...args) {
        dispatch(actions.item.tags.create(...args))
      },

      onItemTagRemove(...args) {
        dispatch(actions.item.tags.delete(...args))
      },

      onMetadataSave(...args) {
        dispatch(actions.metadata.save(...args))
        dispatch(actions.edit.cancel())
      },

      onPhotoContract(...args) {
        dispatch(actions.photo.contract(...args))
      },

      onPhotoCreate(...args) {
        dispatch(actions.photo.create(...args))
      },

      onReferenceCreate(...args) {
        dispatch(actions.photo.referenceCreate(...args))
      },

      onPhotoDelete(payload) {
        if (payload.selections == null) {
          dispatch(actions.photo.delete(payload))
        } else {
          dispatch(actions.selection.delete(payload))
        }
      },

      onPhotoExpand(...args) {
        dispatch(actions.photo.expand(...args))
      },

      onPhotoMove(...args) {
        dispatch(actions.photo.move(...args))
      },

      onPhotoSort(...args) {
        dispatch(actions.photo.order(...args))
      },

      onPhotoSelect(...args) {
        dispatch(actions.photo.select(...args))
      },

      onPhotoError(...args) {
        dispatch(actions.photo.error(...args))
      },

      onTagCreate(data) {
        dispatch(actions.tag.create(data))
        dispatch(actions.edit.cancel())
      },

      onTagDelete(...args) {
        ipc.send('cmd', 'app:delete-tag', { target: { id: args[0] } })
      },

      onSyncProject2Cloud(...args) {
        dispatch(actions.photo.sync(...args))
      },

      onTagSave(data, id) {
        dispatch(actions.tag.save({ ...data, id }))
        dispatch(actions.edit.cancel())
      },

      onSkuSave(data, project) {
        dispatch(actions.tag.saveSku({ data, project }))
      },

      onTagSelect(...args) {
        dispatch(actions.tag.select(...args))
        dispatch(actions.references.load({ tag_id: args[0] }))
      },

      onTemplateImport(files) {
        dispatch(actions.ontology.template.import({ files }))
      },

      onSelectionSort(...args) {
        dispatch(actions.selection.order(...args))
      },

      onNoteCreate(...args) {
        dispatch(actions.note.create(...args))
      },

      onNoteSave(...args) {
        dispatch(actions.note.save(...args))
      },

      onNoteDelete(...args) {
        dispatch(actions.note.delete(...args))
      },

      onNoteRestore(...args) {
        dispatch(actions.note.delete(...args))
      },

      onNoteSelect(...args) {
        dispatch(actions.note.select(...args))
      },

      onEdit(...args) {
        dispatch(actions.edit.start(...args))
      },

      onEditCancel() {
        dispatch(actions.edit.cancel())
      },

      onUiUpdate(...args) {
        dispatch(actions.ui.update(...args))
      }
    })

  )(DropTarget(NativeTypes.FILE, DropTargetSpec, (c, m) => ({
    dt: c.dropTarget(), isOver: m.isOver(), canDrop: m.canDrop()
  }))(ProjectContainer))
}
