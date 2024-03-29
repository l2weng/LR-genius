'use strict'

const PIXI = require('pixi.js/dist/pixi.js')
const { Container, Graphics, Polygon: PixiPolygon } = PIXI
const BLANK = Object.freeze({})
const { COLOR, TOOL, getSelectionColors } = require('../../constants/esper')
const { round } = Math

class Polygon extends Graphics {
  constructor(color) {
    super()
    this.data = BLANK
    this.color = color
  }

  get isBlank() {
    return this.data === BLANK
  }

  get isActive() {
    return this === this.parent.active
  }

  get state() {
    if (this.isActive) return 'active'
    return 'default'
  }

  destroy() {
    this.data = null
    super.destroy({ children: true })
  }

  drawPoint(
    color,
    scale = 1,
    point,
  ) {
    this.beginFill('0xFFFFFF')
    this.lineStyle(scale, '0xFFFFFF', 0)
    this.drawCircle(point.x, point.y, 5 * scale)
    this.endFill()
  }

  drawFirstPoint(
    color,
    scale = 1,
    point,
    points,
  ) {
    this.addChild(new Graphics(), new Graphics())
    this.children[0].beginFill('0xFF0000')
    this.children[0].lineStyle(scale, '0xFF0000', 0)
    this.children[0].drawCircle(point.x, point.y, 5 * scale)
    this.children[0].interactive = true
    this.children[0].buttonMode = true
    this.children[0].once('pointerdown', ()=>this.handlePolygonClose(color, scale, points))
  }

  handlePolygonClose(color, scale, points) {
    if (points.length > 4) {
      const colors = getSelectionColors(color ? color : this.color).selection[this.state]
      this.clear()
      this.children[0].clear()
      this.children[1].clear()
      this.beginFill(...colors.fill)
      this.lineStyle(scale, ...colors.line, 0)
      this.drawPolygon([...points, points[0], points[1]])
      this.endFill()
      this.calculateBounds()
      this.parent.finishPolygon(this._localBounds.getRectangle())
      this.interactive = false
    } else {
      this.parent.cancelPolygonDraw()
    }
  }

  drawLine(
    color,
    scale = 1,
    points,
  ) {
    const colors = getSelectionColors(color ? color : this.color).selection[this.state]
    if (this.children[1]) {
      this.children[1].clear()
      this.children[1].beginFill(...colors.fill)
      this.children[1].lineStyle(scale, ...colors.line, 0)
      this.children[1].drawPolygon(points)
    }
  }

  update(
    color,
    scale = 1,
    { polygon } = this.data,
    state = this.state,
  ) {
    this.clear()
    if (polygon === null || polygon === undefined || polygon.length === 0) return
    const colors = getSelectionColors(color ? color : this.color).selection[state]
    this
    .beginFill(...colors.fill)
    .lineStyle(scale, ...colors.line, 0)
    .drawPolygon([...polygon, polygon[0], polygon[1]])
  }

  sync(data = BLANK) {
    this.data = data
    if (this.isBlank || !this.parent.interactive) {
      this.interactive = false
      this.hitArea = null
    } else {
      this.interactive = true
      this.hitArea = new PixiPolygon(
        data.polygon
      )
    }
  }
}

class PolygonLayer extends Container {
  constructor(color) {
    super()
    this.on('mousemove', this.handleMouseMove)
    this.visible = false
    this.color = color
    this.points = []
    this.rect = null
    this.complete = false
  }

  handleMouseMove(event) {
    const { target } = event

    if (target instanceof Polygon) {
      event.stopPropagation()
      this.active = target

    } else {
      this.active = null
    }
  }

  drawLayerPoint({ point } = BLANK) {
    const scale = 1 / this.parent.scale.y
    if (this.points.length === 0) {
      this.children[this.children.length - 1].drawFirstPoint(this.color, scale, point, this.points)
    } else {
      this.children[this.children.length - 1].drawPoint(this.color, scale, point, this.points)
    }
    this.points.push(round(point.x))
    this.points.push(round(point.y))
  }

  drawLayerLine({ point } = BLANK) {
    if (this.points.length > 0) {
      const scale = 1 / this.parent.scale.y
      this.children[this.children.length - 1].drawLine(this.color, scale, [...this.points, point.x, point.y])
    }
  }

  update({ polygon } = BLANK) {
    if (!this.children.length) return
    const scale = 1 / this.parent.scale.y
    let i = 0

    for (; i < this.children.length - 1; ++i) {
      this.children[i].update(this.children[i].data.color ? this.children[i].data.color : this.color, scale)
    }
    if (polygon !== undefined) {
      this.children[i].update(this.children[i].data.color ? this.children[i].data.color : this.color, scale, polygon,
      'live')
    }
  }

  finishPolygon(rect) {
    this.rect = rect
    this.complete = true
  }

  cancelPolygonDraw() {
    this.points = []
    this.complete = false
    this.children[this.children.length - 1].clear()
    this.children[this.children.length - 1].children[0].clear()
    this.children[this.children.length - 1].children[1].clear()
  }

  destroy() {
    super.destroy({ children: false })
  }

  isVisible({ selection, tool }) {
    return selection == null && (
      tool === TOOL.ARROW || tool === TOOL.SELECT || tool === TOOL.POLYGON
    )
  }

  isInteractive({ tool }) {
    return tool === TOOL.ARROW
  }

  sync(props) {
    this.color = props.shapeColor
    this.visible = this.isVisible(props)
    this.interactive = this.isInteractive(props)

    const { polygons } = props

    for (let i = 0; i < polygons.length; ++i) {
      if (i >= this.children.length) {
        this.addChild(new Polygon(props.shapeColor))
      }

      this.children[i].sync(polygons[i])
    }

    if (this.children.length <= polygons.length) {
      this.addChild(new Polygon(props.shapeColor))
    }

    this.children[polygons.length].sync(BLANK)

    if (this.children.length > polygons.length + 1) {
      for (let s of this.removeChildren(polygons.length + 1)) {
        s.destroy()
      }
    }
  }
}

class PolygonOverlay extends Graphics {
  constructor({ width, height }) {
    super()

    this.beginFill(...COLOR.mask.fill)
    this.drawRect(0, 0, width, height)

    this.cacheAsBitmap = false
    this.visible = false

    this.addChild(new Graphics(), new Graphics())
    this.mask = this.children[0]
    this.line = this.children[1]
  }

  update() {
    this.line.clear()
    this.mask.clear()

    if (this.active === null || this.parent === null) return

    const scale = 1 / this.parent.scale.y
    const { polygon, color } = this.active

    this.line
    .lineStyle(2 * scale, ...getSelectionColors(color).mask.line)
    .beginFill(...getSelectionColors(color).mask.line)
    .drawPolygon([...polygon, polygon[0], polygon[1]])

    this.mask
    .beginFill(0xFFFFFF)
    .moveTo(0, 0)
    .lineTo(this.width, 0)
    .lineTo(this.width, this.height)
    .lineTo(0, this.height)
    .moveTo(polygon[0], polygon[1])
    for (let i = 2; i < polygon.length; i += 2) {
      const pointX = polygon[i]
      const pointY = polygon[i + 1]
      this.mask.lineTo(pointX, pointY )
    }
    this.mask.addHole()
  }

  sync({ selection }) {
    this.active = selection
    this.mask.clear()
    this.visible = selection !== undefined && selection !== null && selection.polygon.length !== 0
  }
}

module.exports = {
  Polygon,
  PolygonOverlay,
  PolygonLayer
}
