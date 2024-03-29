'use strict'

const React = require('react')
const { ItemToolbar } = require('./toolbar')
const { ItemTabHeader, ItemTabBody } = require('./tab')
// const { NotePanel } = require('../note')
const { PanelGroup, Panel } = require('../panel')
const { PhotoPanel } = require('../photo')
const { ReferencePanel } = require('../reference')
const cx = require('classnames')
const { get } = require('../../common/util')
const { keys } = Object

const {
  array, bool, func, number, object, shape, string
} = require('prop-types')


class ItemPanel extends React.PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      hasFirstPanelFocus: false
    }
  }

  setPanel = (panel) => {
    this.first = panel
  }

  handlePhotoCreate = (dropped) => {
    this.props.onPhotoCreate({
      item: get(this.props.items, [0, 'id']),
      files: dropped && dropped.files
    })
  }

  handleReferenceCreate = (dropped) => {
    this.props.onReferenceCreate({
      tag_id: this.props.nav.tags[0],
      files: dropped && dropped.files
    })
  }

  handleResize = (slots) => {
    this.props.onUiUpdate({ panel: { slots } })
  }

  handleTabChange = (tab) => {
    this.props.onUiUpdate({ panel: { tab } })
  }

  handleZoomChange = (zoom) => {
    this.props.onUiUpdate({ panel: { zoom } })
  }

  handleRefZoomChange = (refZoom) => {
    this.props.onUiUpdate({ panel: { refZoom } })
  }

  handleFirstPanelFocus = () => {
    this.setState({ hasFirstPanelFocus: true })
  }

  handleFirstPanelBlur = () => {
    this.setState({ hasFirstPanelFocus: false })
  }

  renderItemToolbar() {
    return (
      <ItemToolbar
        isItemOpen={this.props.isItemOpen}
        onMaximize={this.props.onMaximize}
        onModeChange={this.props.onModeChange}/>
    )
  }

  render() {
    const {
      edit,
      expanded,
      activeSelection,
      keymap,
      // note,
      // notes,
      panel,
      photo,
      references,
      activeTag,
      selections,
      isDisabled,
      isItemOpen,
      onItemPreview,
      // onNoteCreate,
      // onNoteSelect,
      onTagSelect,
      onPhotoContract,
      onPhotoDelete,
      onPhotoError,
      onPhotoExpand,
      onPhotoSelect,
      onPhotoSort,
      onSelectionSort,
      isOwner,
      ...props
    } = this.props
    const hasMultipleItems = this.props.items.length > 1
    const item = hasMultipleItems ? null : this.props.items[0]
    return (
      <PanelGroup
        slots={panel.slots}
        onResize={this.handleResize}
        header={this.renderItemToolbar()}>

        <Panel className={cx('item', 'panel', {
          'nested-tab-focus': this.state.hasFirstPanelFocus
        })}>
          <ItemTabHeader
            tab={panel.tab}
            onChange={this.handleTabChange}/>
          <ItemTabBody {...props}
            tab={panel.tab}
            isDisabled={isDisabled}
            isItemOpen={isItemOpen}
            keymap={keymap}
            isOwner={isOwner}
            activeTag={activeTag}
            onTagSelect={onTagSelect}
            setPanel={this.setPanel}
            onBlur={this.handleFirstPanelBlur}
            onFocus={this.handleFirstPanelFocus}/>
        </Panel>

        <PhotoPanel {...props}
          isDisabled={isDisabled || !item || hasMultipleItems}
          isItemOpen={isItemOpen}
          edit={edit}
          expanded={expanded}
          keymap={keymap}
          zoom={panel.zoom}
          current={photo && photo.id}
          selection={activeSelection}
          selections={selections}
          onContract={onPhotoContract}
          onCreate={this.handlePhotoCreate}
          onDelete={onPhotoDelete}
          onError={onPhotoError}
          onExpand={onPhotoExpand}
          onItemPreview={onItemPreview}
          onSelect={onPhotoSelect}
          onSort={onPhotoSort}
          onSelectionSort={onSelectionSort}
          onZoomChange={this.handleZoomChange}/>
        <ReferencePanel {...props}
          isDisabled={isDisabled || !item || hasMultipleItems}
          isItemOpen={isItemOpen}
          edit={edit}
          expanded={[]}
          keymap={keymap}
          zoom={panel.refZoom}
          current={photo && photo.id}
          selection={0}
          photos={references}
          selections={{}}
          onContract={onPhotoContract}
          onCreate={this.handleReferenceCreate}
          onDelete={onPhotoDelete}
          onError={onPhotoError}
          onExpand={onPhotoExpand}
          onItemPreview={onItemPreview}
          onSelect={onPhotoSelect}
          onSort={onPhotoSort}
          onSelectionSort={onSelectionSort}
          onZoomChange={this.handleRefZoomChange}/>

        {/*<NotePanel {...props}*/}
        {/*isDisabled={isDisabled || !photo || !item || hasMultipleItems}*/}
        {/*isItemOpen={isItemOpen}*/}
        {/*item={item && item.id}*/}
        {/*keymap={keymap.NoteList}*/}
        {/*photo={photo && photo.id}*/}
        {/*notes={notes}*/}
        {/*selection={note}*/}
        {/*onCreate={onNoteCreate}*/}
        {/*onSelect={onNoteSelect}/>*/}
      </PanelGroup>
    )
  }

  static propTypes = {
    cache: string.isRequired,
    data: object.isRequired,
    edit: object.isRequired,
    expanded: array.isRequired,
    activeSelection: number,
    keymap: object.isRequired,
    isDisabled: bool.isRequired,
    isItemOpen: bool.isRequired,
    isOwner: bool.isRequired,
    activeTag: number,
    enableReference: bool.isRequired,
    items: array.isRequired,
    mode: string.isRequired,

    note: object,
    notes: array.isRequired,
    selections: object.isRequired,
    nav: object.isRequired,
    references: array,

    panel: shape({
      slots: array.isRequired,
      tab: string.isRequired,
      zoom: number.isRequired
    }).isRequired,

    photo: shape({
      id: number.isRequired
    }),
    photos: array.isRequired,
    properties: object.isRequired,

    onContextMenu: func.isRequired,
    onEdit: func.isRequired,
    onEditCancel: func,
    onItemOpen: func.isRequired,
    onItemPreview: func.isRequired,
    onItemSave: func.isRequired,
    onItemTagAdd: func.isRequired,
    onItemTagsAdd: func.isRequired,
    onItemTagRemove: func.isRequired,
    onMaximize: func.isRequired,
    onMetadataSave: func.isRequired,
    onModeChange: func.isRequired,
    onNoteCreate: func.isRequired,
    onNoteSelect: func.isRequired,
    onOpenInFolder: func.isRequired,
    onPhotoContract: func.isRequired,
    onPhotoCreate: func.isRequired,
    onReferenceCreate: func.isRequired,
    onPhotoDelete: func.isRequired,
    onPhotoError: func.isRequired,
    onPhotoExpand: func.isRequired,
    onPhotoSelect: func.isRequired,
    onPhotoSort: func.isRequired,
    onTagCreate: func.isRequired,
    onTagSave: func.isRequired,
    onTagSelect: func.isRequired,
    onSelectionSort: func.isRequired,
    onUiUpdate: func.isRequired
  }

  static props = keys(ItemPanel.propTypes)
}

module.exports = {
  ItemPanel
}
