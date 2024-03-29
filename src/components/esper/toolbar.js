'use strict'

const React = require('react')
const { PureComponent } = React
const { Toolbar, ToolbarLeft, ToolbarRight, ToolGroup } = require('../toolbar')
const { Button } = require('../button')
const { Slider } = require('../slider')
const { arrayOf, bool, func, number, string, object } = require('prop-types')
const throttle = require('lodash.throttle')

const { TOOL, MODE } = require('../../constants/esper')
const { SELECTION } = require('../../constants')


const {
  ESPER: {
    ZOOM_SLIDER_PRECISION,
    ZOOM_SLIDER_STEPS
  }
} = require('../../constants/sass')

const {
  IconArrow,
  IconSelection,
  IconRotate,
  IconHand,
  IconSliders,
  IconMirror,
  IconMinusCircle,
  IconPlusCircle,
  IconFit,
  IconFill,
  IconPolygon,
} = require('../icons')


class EsperToolbar extends PureComponent {
  get isZoomToFill() {
    return this.props.mode === MODE.FILL
  }

  get isZoomToFit() {
    return this.props.mode === MODE.FIT
  }

  isToolActive(tool) {
    return this.props.tool === tool
  }

  handlePanelToggle = () => {
    this.props.onPanelChange(!this.props.isPanelVisible)
  }

  handleRotate = () => {
    this.props.onRotationChange(-90)
  }

  handleZoomChange = throttle((zoom, reason) => {
    this.props.onZoomChange({ zoom }, reason === 'button')
  }, 15)

  setZoomToFit = () => {
    this.props.onModeChange(this.isZoomToFit ? MODE.ZOOM : MODE.FIT)
  }

  setZoomToFill = () => {
    this.props.onModeChange(this.isZoomToFill ? MODE.ZOOM : MODE.FILL)
  }

  setArrowTool = () => {
    this.props.onToolChange(TOOL.ARROW)
  }

  setPanTool = () => {
    this.props.onToolChange(TOOL.PAN)
  }

  setSelectTool = () => {
    this.props.onToolChange(TOOL.SELECT)
  }

  setPolygonTool = () =>{
    this.props.onToolChange(TOOL.POLYGON)
  }

  render() {
    return (
      <Toolbar isDraggable={false}>
        <ToolbarLeft>
          <ToolGroup>
            <Button
              noFocus
              icon={<IconArrow/>}
              isActive={this.isToolActive(TOOL.ARROW)}
              isDisabled={this.props.isDisabled}
              onClick={this.setArrowTool}/>
            <Button
              noFocus
              icon={<IconSelection className={`color-${this.props.shapeColor.replace(/\#/g, '')}`}/>}
              title="esper.tool.select"
              isActive={this.isToolActive(TOOL.SELECT)}
              isDisabled={this.props.isDisabled || this.props.isSelectionActive}
              onClick={this.setSelectTool}/>
            <Button
              noFocus
              icon={<IconPolygon className={`color-${this.props.shapeColor.replace(/\#/g, '')}`}/>}
              title="esper.tool.polygon"
              isActive={this.isToolActive(TOOL.POLYGON)}
              isDisabled={this.props.isDisabled || this.props.isSelectionActive}
              onClick={this.setPolygonTool}/>
          </ToolGroup>
          <ToolGroup>
            <Button
              noFocus
              icon={<IconRotate/>}
              title="esper.tool.rotate"
              isDisabled={this.props.isDisabled}
              onClick={this.handleRotate}/>
            <Button
              noFocus
              icon={<IconMirror/>}
              title="esper.tool.mirror"
              isDisabled={this.props.isDisabled}
              onClick={this.props.onMirrorChange}/>
          </ToolGroup>
          <ToolGroup>
            <Button
              noFocus
              icon={<IconHand/>}
              title="esper.tool.pan"
              isActive={this.isToolActive(TOOL.PAN)}
              onClick={this.setPanTool}/>
            <Button
              noFocus
              icon={<IconFill/>}
              title="esper.mode.fill"
              isDisabled={this.props.isDisabled}
              isActive={this.isZoomToFill}
              onClick={this.setZoomToFill}/>
            <Button
              noFocus
              icon={<IconFit/>}
              title="esper.mode.fit"
              isDisabled={this.props.isDisabled}
              isActive={this.isZoomToFit}
              onClick={this.setZoomToFit}/>
          </ToolGroup>
          <ToolGroup>
            <Slider
              value={this.props.zoom}
              min={this.props.minZoom}
              max={this.props.maxZoom}
              precision={this.props.zoomPrecision}
              showCurrentValue
              steps={this.props.zoomSteps}
              minIcon={<IconMinusCircle/>}
              maxIcon={<IconPlusCircle/>}
              isDisabled={this.props.isDisabled}
              onChange={this.handleZoomChange}/>
          </ToolGroup>
        </ToolbarLeft>
        <ToolbarRight>
          <ToolGroup>
            <Button
              noFocus
              icon={<IconSliders/>}
              title="esper.tool.edit"
              isActive={this.props.isPanelVisible}
              onClick={this.handlePanelToggle}/>
          </ToolGroup>
        </ToolbarRight>
      </Toolbar>
    )
  }

  static propTypes = {
    isDisabled: bool.isRequired,
    isSelectionActive: bool.isRequired,
    isPanelVisible: bool.isRequired,
    mode: string.isRequired,
    tool: string.isRequired,
    zoom: number.isRequired,
    zoomPrecision: number.isRequired,
    zoomSteps: arrayOf(number).isRequired,
    minZoom: number.isRequired,
    maxZoom: number.isRequired,
    onMirrorChange: func.isRequired,
    onModeChange: func.isRequired,
    onPanelChange: func.isRequired,
    photo: object,
    onToolChange: func.isRequired,
    onRotationChange: func.isRequired,
    onZoomChange: func.isRequired,
    shapeColor: string.isRequired,
    shapeType: string.isRequired
  }

  static defaultProps = {
    zoomPrecision: ZOOM_SLIDER_PRECISION,
    zoomSteps: ZOOM_SLIDER_STEPS,
    shapeType: []
  }
}

module.exports = {
  EsperToolbar
}
