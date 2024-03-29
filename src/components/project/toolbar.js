'use strict'

const React = require('react')
const { PureComponent } = React
const { FormattedMessage } = require('react-intl')
const { bool, func, number, string, object } = require('prop-types')
const { Toolbar } = require('../toolbar')
const { IconPlus, IconList, IconGrid } = require('../icons')
const { Slider } = require('../slider')
const { Button: Abutton, Icon, Popconfirm } = require('antd')
const { SearchField } = require('../search')
const { Button } = require('../button')
const { empty } = require('../../common/util')
const StartSvg = () => (
  <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
    viewBox="0 0 286.107 286.107" style={{ enableBackground: 'new 0 0 286.107 286.107' }} xmlSpace="preserve" width="1em" height="1em">
    <g>
      <path style={{ fill: '#ec6519' }} d="M237.891,54.663c-10.638-10.772-20.149-19.353-33.978-26.129c-8.689-4.264-19.175-0.59-23.376,8.197
		c-4.228,8.787-0.581,19.362,8.099,23.626c10.298,5.042,17.217,10.62,25.164,18.665c39.011,39.449,39.011,103.632,0,143.072
		c-18.897,19.121-44.043,29.624-70.763,29.624c-26.728,0-51.865-10.512-70.763-29.624c-39.011-39.44-39.011-103.623,0-143.072
		c7.974-8.054,15.858-13.614,25.647-18.647c8.269-4.273,11.728-14.839,7.715-23.635c-4.014-8.778-12.649-12.39-21.123-8.242
		c-13.436,6.597-25.647,15.393-36.311,26.165c-52.303,52.875-52.303,138.897,0,191.781c26.156,26.433,60.5,39.663,94.845,39.663
		c34.353,0,68.698-13.221,94.845-39.663C290.212,193.578,290.212,107.547,237.891,54.663z M143.064,143.027
		c9.869,0,17.878-8.01,17.878-17.878V17.878C160.942,8.01,152.933,0,143.064,0s-17.878,8.01-17.878,17.878v107.27
		C125.186,135.026,133.195,143.027,143.064,143.027z"/>
    </g>
  </svg>
)

class ProjectToolbar extends PureComponent {
  get isEmpty() {
    return this.props.items.length === 0
  }

  render() {
    const {
      canCreateItems,
      isDisabled,
      isDraggable,
      items,
      query,
      zoom,
      maxZoom,
      onDoubleClick,
      onSearch,
      onZoomChange,
      isDisplay,
      isOwner,
      list,
      lists
    } = this.props
    let taskWorkStatus = 0
    if (!empty(lists) && lists[list] && list && lists[list].hasOwnProperty('workStatus')) {
      taskWorkStatus = lists[list].workStatus
    }
    return (
      <Toolbar isDraggable={isDraggable} onDoubleClick={onDoubleClick}>
        {isDisplay ?
          <div className="toolbar-left">
            <div className="tool-group">
              <Slider
                value={zoom}
                max={maxZoom}
                isDisabled={this.isEmpty || isDisabled}
                onChange={onZoomChange}
                minIcon={<IconList/>}
                maxIcon={<IconGrid/>}/>
            </div>
            {isOwner ? <div className="tool-group">
              <Button
                icon={<IconPlus/>}
                isDisabled={isDisabled || !canCreateItems}
                title="toolbar.import"
                onClick={this.props.onItemCreate}/>
            </div> : ''}
            {/*<div className="tool-group">*/}
            {/*  <Button*/}
            {/*    icon={<IconPhotoResources/>}*/}
            {/*    isDisabled={isDisabled || !canCreateItems}*/}
            {/*    title="toolbar.import"*/}
            {/*    onClick={this.props.onDataSetsCreate}/>*/}
            {/*</div>*/}
            {/*<div className="tool-group">*/}
            {/*  <Button*/}
            {/*    icon={<IconExport/>}*/}
            {/*    isDisabled={isDisabled || !canCreateItems}*/}
            {/*    title="toolbar.import"*/}
            {/*    onClick={this.props.onItemCreate}/>*/}
            {/*</div>*/}
          </div> : ''}
        <div className="toolbar-center">
          <div className="item-count">
            <FormattedMessage id="toolbar.items" values={{ count: items }}/>
          </div>
        </div>
        <div className="toolbar-right">
          {/*<div className="tool-group">*/}
          {/*  <Popconfirm placement="right" title="Confirm" onConfirm={()=>this.props.onSubmitTask(list)} okText="Yes" cancelText="No">*/}
          {/*    {list && taskWorkStatus !== 2 && taskWorkStatus !== 3 ? <Abutton  size="small" style={{ marginRight: 8, height: '26px' }}><Icon component={StartSvg} size="small"/>{taskWorkStatus === 0 ? 'Start Labelling' : 'Submit Task'}</Abutton> : ''}*/}
          {/*  </Popconfirm>*/}
          {/*</div>*/}
          <SearchField
            query={query}
            isDisabled={isDisabled}
            onSearch={onSearch}/>
        </div>
      </Toolbar>
    )
  }

  static propTypes = {
    canCreateItems: bool,
    isDraggable: bool,
    isDisabled: bool,
    items: number.isRequired,
    query: string.isRequired,
    maxZoom: number.isRequired,
    zoom: number.isRequired,
    list: number,
    lists: object.isRequired,
    onDoubleClick: func,
    onItemCreate: func.isRequired,
    onDataSetsCreate: func.isRequired,
    onSearch: func.isRequired,
    onZoomChange: func.isRequired,
    isDisplay: bool,
    isOwner: bool,
    onSubmitTask: func.isRequired
  }

  static defaultProps = {
    isDraggable: ARGS.frameless
  }
}


module.exports = {
  ProjectToolbar
}
