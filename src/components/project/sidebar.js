'use strict'

const React = require('react')
const { connect } = require('react-redux')
const { FormattedMessage, intlShape, injectIntl } = require('react-intl')
const { Toolbar } = require('../toolbar')
const { ActivityPane } = require('../activity')
const { BufferedResizable } = require('../resizable')
const { LastImportListNode, ListTree, TrashListNode } = require('../list')
const { ProjectTags } = require('./tags')
const { Sidebar, SidebarBody } = require('../sidebar')
const { ProjectName } = require('./name')
const { TABS, LIST, SASS: { SIDEBAR } } = require('../../constants')
const { has, last } = require('../../common/util')
const { match } = require('../../keymap')
const { testFocusChange } = require('../../dom')
const actions = require('../../actions')
const {  Tooltip, message, Modal, Form } = require('antd')
const { ipcRenderer: ipc  } = require('electron')
const { getUrlFilterParams } = require('../../common/dataUtil')
const { ColleagueTable } = require('../contacts/colleagueTable')
const { IconPlus } = require('../icons')
const { Button } = require('../button')
const { TargetForm } = require('../tag/targetForm')
const WrappedTargetForm = Form.create()(TargetForm)

const { userInfo } = ARGS
const axios = require('axios')

const {
  bool, shape, string, object, arrayOf, func, number
} = require('prop-types')

const {
  getActivities,
  getListHold,
  getListSubTree
} = require('../../selectors')

const ColleagueList = Form.create()(props => {
  const { modalVisible, form, handleAssign, handleModalVisible, colleagues, defaultIdx, intl } = props
  const okHandle = () => {
    form.validateFields((err, fieldsValue) => {
      if (err) return
      form.resetFields()
      handleAssign(fieldsValue)
    })
  }
  const onUserAssign = (userId) =>{
    handleAssign(userId)
  }
  return (
    <Modal
      destroyOnClose
      style={{ top: 60 }}
      title={intl.formatMessage({ id: 'sidebar.assignTask' })}
      maskClosable={false}
      visible={modalVisible}
      onOk={okHandle}
      footer={null}
      onCancel={() => handleModalVisible()}>
      <ColleagueTable data={colleagues} handleAssign={onUserAssign} defaultIdx={defaultIdx}/>
    </Modal>
  )
})

class ProjectSidebar extends React.PureComponent {

  state = {
    modalVisible: false,
    skuModalVisible: false,
    colleagues: [],
    defaultIdx: [],
    assignType: '',
    syncTaskId: '',
    listId: 0,
  }

  get isEditing() {
    return has(this.props.edit, 'project')
  }

  get hasActiveFilters() {
    return this.props.tagSelection.length > 0
  }

  get hasSelection() {
    return this.props.list != null ||
      this.props.isTrashSelected ||
      this.props.isLastImportSelected && this.props.hasLastImport
  }

  get tabIndex() {
    return (this.props.isDisabled) ? null : TABS.ProjectSidebar
  }

  getFirstList() {
    return this.props.listwalk[0]
  }

  getLastList() {
    return last(this.props.listwalk)
  }

  getNextList() {
    return this.getListAt(1)
  }

  getPrevList() {
    return this.getListAt(-1)
  }

  getListAt(offset = 1) {
    let list = this.props.list
    let walk = this.props.listwalk

    let idx = walk.indexOf(list)
    if (idx < 0) return

    return walk[idx + offset]
  }

  isListSelected(list) {
    return list && list === this.props.list
  }

  isListEmpty() {
    return this.props.listwalk.length === 0
  }

  next() {
    switch (true) {
      case this.props.isTrashSelected:
        return
      case this.props.isLastImportSelected:
        return this.handleTrashSelect()
      case this.isListEmpty():
      case this.isListSelected(this.getLastList()):
        return this.props.hasLastImport ?
          this.handleLastImportSelect() :
          this.handleTrashSelect()
      case !this.hasSelection:
        return this.handleListSelect(this.getFirstList())
      default:
        return this.handleListSelect(this.getNextList())
    }
  }

  prev() {
    switch (true) {
      case !this.hasSelection:
        return
      case this.props.isTrashSelected && this.props.hasLastImport:
        return this.handleLastImportSelect()
      case this.isListEmpty():
      case this.isListSelected(this.getFirstList()):
        return this.handleSelect()
      case this.props.isLastImportSelected:
        return this.handleListSelect(this.getLastList())
      case this.props.isTrashSelected:
        return this.props.hasLastImport ?
          this.handleLastImportSelect() :
          this.handleListSelect(this.getLastList())
      default:
        return this.handleListSelect(this.getPrevList())
    }
  }

  collapse() {
    if (this.props.list != null) {
      this.props.onListCollapse(this.props.list)
    }
  }

  expand() {
    if (this.props.list != null) {
      this.props.onListExpand(this.props.list)
    }
  }

  edit() {
    switch (true) {
      case (!this.hasSelection):
        this.props.onProjectEdit()
        break
      case (this.props.list != null):
        this.props.onListEdit(this.props.list)
        break
    }
  }

  handleSelect() {
    this.props.onSelect({ list: null, trash: null }, { throttle: true })
  }

  handleMouseDown = () => {
    this.hasFocusChanged = testFocusChange()
  }

  handleListSave = (payload) => {
    this.props.onListSave({ syncProjectId: this.props.project.syncProjectId, projectId: this.props.project.id, ...payload })
  }

  handleTagCreate = (payload) => {
    payload.syncProjectId = this.props.project.syncProjectId
    this.props.onTagCreate({ ...payload })
  }

  handleAddWorkers = (type, syncTaskId, listId, defaultIdx = []) => {
    let self = this
    let query = getUrlFilterParams({ companyId: userInfo.user.companyId, userId: userInfo.user.userId }, ['companyId', 'userId'])

    axios.get(`${ARGS.apiServer}/graphql?query={queryColleaguesAndFriends${query} { key: userId userId name email status phone userType userTypeDesc statusDesc avatarColor machineId prefix }}`)
    .then(function (response) {
      if (response.status === 200) {
        self.setState({ colleagues: response.data.data.queryColleaguesAndFriends, defaultIdx, modalVisible: true ,assignType: type, syncTaskId: syncTaskId, listId })
        // self.setState({ modalVisible: true })
      }
    })
    .catch(function () {
      message.error(self.props.intl.formatMessage({ id: 'common.error' }))
    })
  }

  handleClick = () => {
    if (this.hasSelection || this.hasActiveFilters) {
      return this.handleSelect()
    }

    if (!this.hasFocusChanged()) {
      this.props.onEdit({
        project: { name: this.props.project.name }
      })
    }
  }

  handleChange = (name) => {
    this.props.onProjectSave({ name })
  }

  handleSyncProjectData = () => {
    this.props.onSyncProjectData({ project: this.props.project })
  }

  handleTrashSelect = () => {
    this.props.onSelect({ trash: true }, { throttle: true })
  }

  handleLastImportSelect = () => {
    this.props.onSelect({ imports: true }, { throttle: true })
  }

  handleTrashDropItems = (items) => {
    this.props.onItemDelete(items.map(it => it.id))
  }

  handleListClick = (list) => {
    if (!this.handleListSelect(list.id, list.syncTaskId)) {
      if (!this.hasFocusChanged()) {
        this.props.onEdit({ list: { id: list.id } })
      }
    }
  }

  handleListSelect = (list, syncTaskId) => {
    if (list && (!this.isListSelected(list) || this.hasActiveFilters)) {
      this.props.onSelect({ list, syncTaskId }, { throttle: true })
      return true
    }
  }

  handleKeyDown = (event) => {
    switch (match(this.props.keymap.Sidebar, event)) {
      case 'prev':
        this.prev()
        break
      case 'next':
        this.next()
        break
      case 'clear':
        this.handleSelect()
        break
      case 'expand':
        this.expand()
        break
      case 'collapse':
        this.collapse()
        break
      case 'edit':
        this.edit()
        break
      default:
        return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  handleContextMenu = (event) => {
    this.props.onContextMenu(event, 'sidebar')
  }

  addNewTask = () =>{
    ipc.send('cmd', 'app:create-list')
  }

  addNewSKu = () =>{
    // ipc.send('cmd', 'app:create-tag')
    this.setState({
      skuModalVisible: true,
    })
  }

  handleModalVisible = () => {
    this.setState({
      modalVisible: false,
    })
  }

  handleSkuModalVisible = () => {
    this.setState({
      skuModalVisible: false,
    })
  }

  handleAssign = selectedUserIdx =>{
    let { syncTaskId, listId } = this.state
    let { project } = this.props
    let self = this
    axios.post(`${ARGS.apiServer}/tasks/addWorker`, { workerIds: selectedUserIdx, projectId: project.syncProjectId, taskId: syncTaskId })
    .then(function (response) {
      if (response.status === 200) {
        self.props.updateListOwner({ workers: response.data.workers, syncTaskId: syncTaskId, id: listId })
        message.success(self.props.intl.formatMessage({ id: 'sidebar.taskAssignSuccess' }))
        ipc.send('cmd', 'app:sync-project-file')
        self.setState({ modalVisible: false })
      }
    })
    .catch(function () {
      message.warning(self.props.intl.formatMessage({ id: 'sidebar.taskAssignError' }))
    })
  }

  render() {
    const {
      edit,
      project,
      onContextMenu,
      onEditCancel,
      onItemImport,
      onItemTagAdd,
      onTagDelete,
      onTagSave,
      onTagSelect,
      onSkuSave,
      onSyncProject2Cloud,
      isOwner
    } = this.props
    let root = this.props.lists[this.props.root]
    const { modalVisible, colleagues, defaultIdx, skuModalVisible } = this.state
    const parentMethods = {
      handleAssign: this.handleAssign,
      handleModalVisible: this.handleModalVisible,
    }
    const skuParentMethods = {
      handleSkuModalVisible: this.handleSkuModalVisible
    }

    return (
      <BufferedResizable
        edge="right"
        value={this.props.width}
        min={SIDEBAR.MIN_WIDTH}
        max={SIDEBAR.MAX_WIDTH}
        onChange={this.props.onResize}>
        <Sidebar>
          {this.props.hasToolbar &&
            <Toolbar onDoubleClick={this.props.onMaximize}/>}

          <SidebarBody onContextMenu={this.handleContextMenu}>
            <section
              tabIndex={this.tabIndex}
              onKeyDown={this.handleKeyDown}
              onMouseDown={this.handleMouseDown}>
              <nav>
                <ol>
                  <h2><FormattedMessage id="sidebar.project"/></h2>
                  <ProjectName
                    onSyncProject2Cloud={onSyncProject2Cloud}
                    onSyncProjectData={this.handleSyncProjectData}
                    name={project.name}
                    synced={project.synced}
                    isOwner={isOwner}
                    projectId={project.id || ''}
                    isSelected={!this.hasSelection}
                    isEditing={this.isEditing}
                    onChange={this.handleChange}
                    onClick={this.handleClick}
                    onEditCancel={onEditCancel}
                    onDrop={onItemImport}/>
                </ol>
              </nav>

              <h3>
                <FormattedMessage id="sidebar.lists"/>
                {isOwner ? <Tooltip placement="right" title={this.props.intl.formatMessage({ id: 'sidebar.addTask' })}><span className="functionIcon" style={{ padding: 0 }}>
                  <Button
                    icon={<IconPlus/>}
                    onClick={this.addNewTask}/>
                </span></Tooltip> : ''}
              </h3>
              <nav>
                {root &&
                  <ListTree
                    parent={root}
                    lists={this.props.lists}
                    edit={this.props.edit.list}
                    expand={this.props.expand}
                    hold={this.props.hold}
                    project={this.props.project}
                    isOwner={isOwner}
                    isExpanded
                    selection={this.props.list}
                    onContextMenu={onContextMenu}
                    onDropFiles={onItemImport}
                    onDropItems={this.props.onListItemsAdd}
                    onAddWorkers={this.handleAddWorkers}
                    onClick={this.handleListClick}
                    onSubmitTask={this.handleSubmitTask}
                    onEditCancel={onEditCancel}
                    onExpand={this.props.onListExpand}
                    onCollapse={this.props.onListCollapse}
                    onMove={this.props.onListMove}
                    onSave={this.handleListSave}/>}
                <ol>
                  {this.props.hasLastImport &&
                    <LastImportListNode
                      isSelected={this.props.isLastImportSelected}
                      onClick={this.handleLastImportSelect}/>}
                  <TrashListNode
                    isSelected={this.props.isTrashSelected}
                    onContextMenu={onContextMenu}
                    onDropItems={this.handleTrashDropItems}
                    onClick={this.handleTrashSelect}/>
                </ol>
              </nav>
            </section>

            <section>
              <h2><FormattedMessage id="sidebar.tags"/>
                {isOwner ?
                  <Tooltip placement="right" title={this.props.intl.formatMessage({ id: 'sidebar.addTarget' })}><span style={{ padding: 0 }} className="functionIcon">
                    <Button
                      icon={<IconPlus/>}
                      onClick={this.addNewSKu}/>
                  </span></Tooltip> : ''}
              </h2>
              <ProjectTags
                keymap={this.props.keymap.TagList}
                selection={this.props.tagSelection}
                edit={edit.tag}
                onEditCancel={onEditCancel}
                onCreate={this.handleTagCreate}
                onDelete={onTagDelete}
                onDropItems={onItemTagAdd}
                onSave={onTagSave}
                onSelect={onTagSelect}
                onContextMenu={onContextMenu}/>
            </section>

          </SidebarBody>
          <ActivityPane activities={this.props.activities}/>
        </Sidebar>
        <ColleagueList {...parentMethods} modalVisible={modalVisible} colleagues={colleagues} defaultIdx={defaultIdx} intl={this.props.intl}/>
        <WrappedTargetForm {...skuParentMethods} skuModalVisible={skuModalVisible} tasks={this.props.lists} saveSku={onSkuSave}/>
      </BufferedResizable>
    )
  }

  static propTypes = {
    intl: intlShape.isRequired,
    activities: arrayOf(object).isRequired,
    edit: object.isRequired,
    expand: object.isRequired,
    hasLastImport: bool.isRequired,
    isOwner: bool.isRequired,
    hasToolbar: bool,
    hold: object.isRequired,
    isDisabled: bool,
    isLastImportSelected: bool,
    isTrashSelected: bool,
    keymap: object.isRequired,
    list: number,
    lists: object.isRequired,
    listwalk: arrayOf(number).isRequired,
    onMaximize: func.isRequired,
    project: shape({
      file: string,
      name: string,
      items: number,
      synced: number
    }).isRequired,
    root: number.isRequired,
    tagSelection: arrayOf(number).isRequired,
    width: number.isRequired,
    onContextMenu: func.isRequired,
    onEdit: func.isRequired,
    onEditCancel: func.isRequired,
    onItemDelete: func.isRequired,
    onItemImport: func.isRequired,
    onItemTagAdd: func.isRequired,
    onListCollapse: func.isRequired,
    onListEdit: func.isRequired,
    onListExpand: func.isRequired,
    onListItemsAdd: func.isRequired,
    onListMove: func.isRequired,
    onListSave: func.isRequired,
    onProjectEdit: func.isRequired,
    onProjectSave: func.isRequired,
    onResize: func.isRequired,
    onSelect: func.isRequired,
    onTagCreate: func.isRequired,
    onTagDelete: func.isRequired,
    onTagSave: func.isRequired,
    onSkuSave: func.isRequired,
    onTagSelect: func.isRequired,
    onSyncProject2Cloud: func.isRequired,
    onSyncProjectData: func.isRequired,
    updateListOwner: func.isRequired,
    onSubmitTask: func.isRequired
  }

  static defaultProps = {
    hasToolbar: ARGS.frameless,
    root: LIST.ROOT
  }

  static props = Object.keys(ProjectSidebar.propTypes)
}


module.exports = {
  ProjectSidebar: connect(
    (state, { root }) => ({
      activities: getActivities(state),
      expand: state.sidebar.expand,
      hasLastImport: state.imports.length > 0,
      hold: getListHold(state),
      isLastImportSelected: state.nav.imports,
      isTrashSelected: state.nav.trash,
      listwalk: getListSubTree(state, { root: root || LIST.ROOT }),
      project: state.project,
      tagSelection: state.nav.tags,
      width: state.ui.sidebar.width
    }),

    (dispatch) => ({
      onListCollapse(...args) {
        dispatch(actions.list.collapse(...args))
      },

      onListExpand(...args) {
        dispatch(actions.list.expand(...args))
      },

      onSubmitTask(...args) {
        dispatch(actions.list.submitTask(...args))
      },

      onSyncProjectData(project) {
        dispatch(actions.list.load(project))
      },

      onListItemsAdd({ list, items }) {
        dispatch(actions.list.items.add({
          id: list, items: items.map(item => item.id)
        }))
      },

      onListEdit(id) {
        dispatch(actions.edit.start({ list: { id } }))
      },

      onListSave(...args) {
        dispatch(actions.list.save(...args))
      },

      onListMove(...args) {
        dispatch(actions.list.move(...args))
      },

      onProjectEdit() {
        dispatch(actions.edit.start({ project: { name: true } }))
      },

      onProjectSave(...args) {
        dispatch(actions.project.save(...args))
        dispatch(actions.edit.cancel())
      },

      updateListOwner(...args) {
        dispatch(actions.list.updateOwner(...args))
      },

      onResize(width) {
        dispatch(actions.ui.update({
          sidebar: { width: Math.round(width) }
        }))
      }
    })
  )(injectIntl(ProjectSidebar))
}
