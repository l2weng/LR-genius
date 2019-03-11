'use strict'

const React = require('react')
const { DropTarget } = require('react-dnd')
const { NativeTypes } = require('react-dnd-electron-backend')
const { IconMaze } = require('../icons')
const { Editable } = require('../editable')
const { SIDEBAR } = require('../../constants')
const { isValidImage } = require('../../image')
const cx = require('classnames')
const { bool, func, string } = require('prop-types')
const {  Tooltip, Icon } = require('antd')

class ProjectName extends React.PureComponent {
  get classes() {
    return {
      'project-name': true,
      'active': this.props.isSelected,
      'over': this.props.isOver && this.props.canDrop
    }
  }

  render() {
    return this.props.dt(
      <li className={cx(this.classes)}>
        <div className="list-node-container">
          <IconMaze/>
          <div className="name" onClick={this.props.onClick}>
            <Editable
              value={this.props.name}
              isRequired
              resize
              isActive={this.props.isEditing}
              onCancel={this.props.onEditCancel}
              onChange={this.props.onChange}/>
          </div>
          {this.props.isOwner ? <div>
            <span className="functionIcon" onClick={this.props.onSyncProject2Cloud}><Tooltip placement="right" title="同步到云">
              <Icon type="cloud" />
            </Tooltip>
            </span>
            <span className="functionIcon" onClick={() => this.props.onAddWorkers(SIDEBAR.PROJECT, this.props.projectId)}><Tooltip placement="right" title="分配项目">
              <Icon type="user-add"/>
            </Tooltip>
            </span>
          </div> : ''}
          <span className="functionIcon"><Tooltip placement="right" title="项目详情">
            <Icon type="info-circle"/>
          </Tooltip>
          </span>
        </div>
      </li>
    )
  }


  static propTypes = {
    name: string.isRequired,
    projectId: string.isRequired,
    isOwner: bool.isRequired,
    isEditing: bool,
    isSelected: bool,
    isOver: bool,
    canDrop: bool,
    dt: func.isRequired,
    onClick: func.isRequired,
    onEditCancel: func.isRequired,
    onChange: func.isRequired,
    onDrop: func.isRequired,
    onSyncProject2Cloud: func.isRequired,
    onAddWorkers: func.isRequired,
  }
}

const spec = {
  drop({ onDrop }, monitor) {
    const { files } = monitor.getItem()

    const images = files
      .filter(isValidImage)
      .map(file => file.path)

    return onDrop({ files: images }), { images }
  },

  canDrop(_, monitor) {
    return !!monitor.getItem().types.find(type => isValidImage({ type }))
  }
}

const collect = (connect, monitor) => ({
  dt: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop()
})


module.exports = {
  ProjectName: DropTarget(
    NativeTypes.FILE, spec, collect
  )(ProjectName)
}
