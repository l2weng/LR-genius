'use strict'

const React = require('react')
const { PureComponent } = React
const { FormattedMessage } = require('react-intl')
const { Toolbar, ToolGroup } = require('../toolbar')
const { Slider } = require('../slider')
const { Button } = require('../button')
const { number, bool, func, array } = require('prop-types')

const {
  IconPhoto, IconPlus, IconListSmall, IconGridSmall
} = require('../icons')


class PhotoToolbar extends PureComponent {
  handleCreate = () => {
    this.props.onCreate()
  }

  render() {
    const {
      hasCreateButton,
      isDisabled,
      enableReference,
      zoom,
      maxZoom,
      onZoomChange,
      references
    } = this.props
    return (
      <Toolbar isDraggable={false}>
        <div className="toolbar-left">
          <IconPhoto/>
          <h4>
            <FormattedMessage
              id="panel.reference.title"
              values={{ count: references.length }}/>
          </h4>
        </div>

        <div className="toolbar-right">
          {
            hasCreateButton &&
              <ToolGroup>
                <Button
                  icon={<IconPlus/>}
                  isDisabled={!enableReference}
                  title="panel.photo.create"
                  onClick={this.handleCreate}/>
              </ToolGroup>
          }
          <ToolGroup>
            <Slider
              value={zoom}
              max={maxZoom}
              size="sm"
              minIcon={<IconListSmall/>}
              maxIcon={<IconGridSmall/>}
              isDisabled={false}
              onChange={onZoomChange}/>
          </ToolGroup>
        </div>
      </Toolbar>
    )
  }


  static propTypes = {
    canCreate: bool,
    enableReference: bool,
    hasCreateButton: bool,
    isDisabled: bool,
    references: array.isRequired,
    maxZoom: number.isRequired,
    zoom: number.isRequired,
    onCreate: func.isRequired,
    onZoomChange: func.isRequired
  }
}

module.exports = {
  PhotoToolbar
}