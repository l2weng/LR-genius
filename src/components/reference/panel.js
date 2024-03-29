'use strict'

const React = require('react')
const { array, bool, number, func, object } = require('prop-types')
const { DropTarget } = require('react-dnd')
const { NativeTypes } = require('react-dnd-electron-backend')
const { Panel } = require('../panel')
const { PhotoToolbar } = require('./toolbar')
const { PhotoList } = require('./list')
const { ReferencesGrid } = require('./grid')
const { isValidImage } = require('../../image')
const { pick } = require('../../common/util')
const { PHOTO } = require('../../constants/sass')
const cx = require('classnames')


class ReferencePanel extends Panel {
  get classes() {
    return {
      ...super.classes,
      'drop-target': !this.props.isDisabled,
      'over': this.props.isOver && this.props.canDrop
    }
  }

  connect(element) {
    return this.props.isDisabled ? element : this.props.dt(element)
  }

  renderToolbar() {
    return (
      <PhotoToolbar
        photos={this.props.photos.length}
        enableReference={this.props.enableReference}
        zoom={this.props.zoom}
        maxZoom={PHOTO.ZOOM.length - 1}
        onZoomChange={this.props.onZoomChange}
        references={this.props.references}
        hasCreateButton
        canCreate={this.props.enableReference}
        isDisabled={this.props.isClosed || !this.props.photos.length}
        onCreate={this.props.onCreate}/>
    )
  }

  renderContent() {
    const { onDelete, onEdit, onMetadataSave, zoom } = this.props
    const props = {
      ...this.props,
      size: PHOTO.ZOOM[zoom],
      onBlur: this.handleNestedBlur,
      onChange: onMetadataSave,
      onDelete,
      onDropImages: this.handleDropFiles,
      onEdit,
      onFocus: this.handleNestedTabFocus
    }
    const PhotoIterator = zoom ? ReferencesGrid : PhotoList

    return (
      <PhotoIterator {...pick(props, PhotoIterator.getPropKeys())}/>
    )
  }

  render() {
    const toolbar = this.renderToolbar()
    const content = this.renderContent()
    const classes = {
      'nested-tab-focus': this.state.hasNestedTabFocus,
      'has-active': this.props.current != null
    }
    return (
      <section className={cx('photo-panel', 'panel', classes)}>
        {this.renderHeader(toolbar)}
        {this.connect(this.renderBody(content))}
      </section>
    )
  }


  static propTypes = {
    canDrop: bool,
    isClosed: bool,
    isDisabled: bool,
    enableReference: bool,
    isOver: bool,
    current: number,
    photos: array.isRequired,
    zoom: number.isRequired,
    dt: func.isRequired,
    onContract: func.isRequired,
    onCreate: func.isRequired,
    onDelete: func.isRequired,
    onExpand: func.isRequired,
    onEdit: func.isRequired,
    onMetadataSave: func.isRequired,
    onZoomChange: func.isRequired,
    references: array,
  }
}


const spec = {
  drop({ onCreate }, monitor) {
    const files = monitor.getItem()
      .files
      .filter(isValidImage)
      .map(file => file.path)

    return onCreate({ files })
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
  ReferencePanel: DropTarget(NativeTypes.FILE, spec, collect)(ReferencePanel)
}
