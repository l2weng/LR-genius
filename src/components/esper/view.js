'use strict'

const React = require('react')
const { Component } = React
const { array, func, object, string } = require('prop-types')
const { append, bounds, createDragHandler, on, off } = require('../../dom')
const css = require('../../css')
const { restrict } = require('../../common/util')
const { rad } = require('../../common/math')
const PIXI = require('pixi.js/dist/pixi.js')
const { TextureCache, skipHello } = PIXI.utils
const { constrain, Picture } = require('./picture')
const { Selection  } = require('./selection')
const { Polygon  } = require('./polygon')
const TWEEN = require('@tweenjs/tween.js')
const { TOOL } = require('../../constants/esper')
const { SELECTION } = require('../../constants')
const debounce = require('lodash.debounce')
const { PI, floor, round } = Math

const {
  ESPER: {
    CURSOR,
    FADE_DURATION,
    ZOOM_LINEAR_MAX
  }
} = require('../../constants/sass')

PIXI.settings.RETINA_PREFIX = /@2x!/

class EsperView extends Component {
  componentDidMount() {
    const { width, height } = bounds(this.container)

    this.tweens = new TWEEN.Group()
    this.selectionStartTime = 0
    this.polygonStartTime = 0

    skipHello()

    this.pixi = new PIXI.Application({
      antialias: false,
      forceCanvas: !ARGS.webgl,
      roundPixels: false,
      resolution: round(devicePixelRatio),
      transparent: true,
      width,
      height
    })

    this.isDoubleClick()

    this.m = matchMedia('(max-resolution: 1dppx)')
    this.m.addListener(this.handleResolutionChange)

    this.pixi.loader.onError.add(this.handleLoadError)
    this.pixi.loader.onLoad.add(this.handleLoadProgress)
    this.pixi.ticker.add(this.update)
    this.pixi.renderer.autoResize = true

    for (let name in TOOL) {
      addCursorStyle(
        this.pixi.renderer.plugins.interaction.cursorStyles, TOOL[name]
      )
    }

    append(this.pixi.view, this.container)

    on(this.container, 'wheel', this.handleWheel, { passive: true })
  }

  componentWillUnmount() {
    this.stop.flush()
    this.tweens.removeAll()
    this.pixi.destroy(true)
    this.m.removeListener(this.handleResolutionChange)
    off(this.container, 'wheel', this.handleWheel, { passive: true })
    if (this.drag.current) this.drag.stop()
  }

  componentWillReceiveProps(props) {
    if (this.image != null) {
      if (props.selection !== null && props.selection !== undefined) {
        if (props.selection.polygon !== null) {
          this.image.polygonOverlay.sync(props)
          this.image.overlay.visible = false
        } else {
          this.image.overlay.sync(props)
          this.image.polygonOverlay.visible = false
        }
      } else {
        this.image.overlay.sync(props)
        this.image.polygonOverlay.sync(props)
      }
      this.image.selections.sync(props)
      this.image.polygons.sync(props)
      this.image.cursor = props.tool
      this.pixi.render()
      this.selectionStartTime = performance.now()
    }
  }

  shouldComponentUpdate() {
    return false
  }

  start = () => {
    this.stop.cancel()
    this.pixi.start()
  }

  stop = debounce(() => {
    this.pixi.stop()
  }, 2000)

  resume = () => {
    this.start()
    this.stop()
  }

  get screen() {
    return this.pixi.screen
  }

  get isStarted() {
    return !!this.pixi.ticker.started
  }

  get isDragging() {
    return this.drag.current != null
  }

  getInnerBounds(...args) {
    return this.image.getInnerBounds(this.screen, ...args)
  }

  isDoubleClick(time = Date.now(), threshold = 350) {
    try {
      return this.isDoubleClickSupported() &&
        (time - this.lastClickTime) <= threshold
    } finally {
      this.lastClickTime = time
    }
  }

  isDoubleClickSupported(tool = this.props.tool) {
    return tool === TOOL.PAN || tool === TOOL.ARROW
  }

  async reset(props) {
    this.fadeOut(this.image)
    this.image = null
    props.color = this.props.shapeColor

    if (props.src != null) {
      this.image = new Picture(props)

      try {
        this.image.bg.texture = await this.load(props.src)
        this.image.interactive = true
        this.image.on('mousedown', this.handleMouseDown)
      } catch (_) {
        this.props.onPhotoError(props.photo)
      }

      this.adjust(props)
      this.rotate(props)
      const { mirror, x, y, zoom } = props

      this.setScaleMode(this.image.bg.texture, zoom)
      this.image.scale.x = mirror ? -zoom : zoom
      this.image.scale.y = zoom

      this.image.position.set(x, y)
      this.image.constrain(this.screen)
      this.image.cursor = props.tool

      this.pixi.stage.addChildAt(this.image, 0)
      this.persist()
      this.pixi.render()
    }
  }

  sync(props, duration = 0) {
    if (this.image == null) return

    const { angle, mirror, x, y, zoom } = props
    const { position, scale } = this.image

    this.setScaleMode(this.image.bg.texture, zoom)
    this.adjust(props)

    const zx = mirror ? -1 : 1
    const next = constrain({ x, y, zoom }, this.getInnerBounds(zoom))

    // TODO fixate, change pivot and rotate after move and scale!
    this.image.scale.x = scale.y * zx
    this.image.rotation = rad(angle)

    this
      .animate({
        x: position.x,
        y: position.y,
        zoom: scale.y
      }, 'sync', { complete: this.persist })
      .to(next, duration * 0.67)
      .onUpdate(m => {
        this.image.scale.x = m.zoom * zx
        this.image.scale.y = m.zoom
        this.image.x = m.x
        this.image.y = m.y
      })
      .start()
  }


  makeInteractive(sprite) {
    if (sprite == null || sprite.interactive) return
  }

  setScaleMode(texture, zoom, renderer = this.pixi.renderer) {
    if (texture == null) return

    const { baseTexture } = texture
    const pixellate = (zoom > ZOOM_LINEAR_MAX)
    const scaleMode = pixellate ?
      PIXI.SCALE_MODES.NEAREST :
      PIXI.SCALE_MODES.LINEAR

    if (baseTexture.scaleMode !== scaleMode) {
      baseTexture.scaleMode = scaleMode

      // HACK: Updating scale mode dynamically is broken in Pixi v4.
      // See Pixi #4096.
      const glTexture = baseTexture._glTextures[renderer.CONTEXT_UID]

      if (glTexture) {
        glTexture.bind()
        glTexture[`enable${pixellate ? 'Nearest' : 'Linear'}Scaling`]()
      }
    }
  }

  resize({ width, height, zoom, mirror }) {
    width = round(width)
    height = round(height)

    this.pixi.renderer.resize(width, height)
    this.pixi.render()

    if (this.image == null || zoom == null) return

    this.image.constrain({ width, height }, zoom)
    this.setScaleMode(this.image.bg.texture, zoom)
    this.image.scale.set(mirror ? -zoom : zoom, zoom)
    this.persist()
    this.pixi.render()
  }

  move({ x, y }, duration = 0) {
    const { position } = this.image
    const next = constrain({ x, y }, this.getInnerBounds())

    if (equal(position, next)) return

    this
      .animate(position, 'move', { complete: this.persist })
      .to(next, duration)
      .start()
  }

  scale({ mirror, zoom }, duration = 0, { x, y } = {}) {
    const { scale, position, bg } = this.image
    const { screen } = this

    const zx = mirror ? -1 : 1
    const dz = zoom / scale.y

    x = x == null ? screen.width / 2 : x
    y = y == null ? screen.height / 2 : y

    const dx = (x - position.x)
    const dy = (y - position.y)

    const next = constrain({
      x: position.x + dx - dx * dz,
      y: position.y + dy - dy * dz,
      zoom
    }, this.getInnerBounds(zoom))

    this.setScaleMode(bg.texture, zoom)

    this
      .animate({
        x: position.x,
        y: position.y,
        zoom: scale.y
      }, 'zoom', { complete: this.persist })
      .to(next, duration)
      .onUpdate(m => {
        this.image.scale.x = m.zoom * zx
        this.image.scale.y = m.zoom
        this.image.x = m.x
        this.image.y = m.y
      })
      .start()
  }

  rotate({ angle }, duration = 0) {
    if (duration > 0) {
      const cur = this.image.rotation
      const tgt = rad(angle)

      // Always rotate counter-clockwise!
      const tmp = (tgt > cur) ? cur - (2 * PI - tgt) : tgt

      this.animate(this.image, 'rotate', {
        done: () => {
          this.image.rotation = tgt
          this.persist()
        }
      })
        .to({ rotation: tmp }, duration)
        .start()

    } else {
      this.image.rotation = rad(angle)
      this.pixi.render()
    }
  }

  adjust({ brightness, contrast, hue, negative, saturation }) {
    this.image
      .brightness(brightness)
      .contrast(contrast)
      .hue(hue)
      .negative(negative)
      .saturation(saturation)
    this.pixi.render()
  }

  fadeOut(thing, duration = FADE_DURATION) {
    if (thing == null) return
    thing.interactive = false
    // if (!this.isStarted) return thing.destroy()
    this
      .animate(thing, null, { done: () => thing.destroy() })
      .to({ alpha: 0 }, duration)
      .start()
  }

  animate(thing, scope, { stop, complete, done } = {}) {
    const tween = new TWEEN.Tween(thing, this.tweens)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onStart(() => {
        if (scope != null) {
          const current = this.tweens[scope]
          if (current) current.stop()
          this.tweens[scope] = tween
        }
      })
      .onStop(() => {
        if (scope != null) this.tweens[scope] = null
        if (typeof stop === 'function') stop()
        if (typeof done === 'function') done()
        this.stop()
      })
      .onComplete(() => {
        if (scope != null) this.tweens[scope] = null
        if (typeof complete === 'function') complete()
        if (typeof done === 'function') done()
        this.stop()
      })

    this.start()
    return tween
  }


  load(url) {
    return new Promise((resolve, reject) => {
      url = url.replace(/#/g, '%23')

      if (TextureCache[url]) {
        return resolve(TextureCache[url])
      }

      this.pixi.loader
        .reset()
        .add(url)
        .load((_, { [url]: res }) => {
          if (res == null) return reject()
          if (res.error) return reject(res.error)

          // Loading typically happens on item open while
          // the view transition is in progress: this
          // adds a slight delay but improves the overall
          // smoothness of the transition!
          requestIdleCallback(() => resolve(res.texture), { timeout: 500 })
        })
    })
  }

  update = () => {
    this.tweens.update(performance.now())
    if (this.image == null) return

    if (this.image.polygons.visible) {
      this.image.polygons.update()
    }

    if (this.image.polygonOverlay.visible) {
      this.image.polygonOverlay.update()
    }

    if (this.image.selections.visible) {
      this.image.selections.update(this.drag.current)
    }

    if (this.image.overlay.visible) {
      this.image.overlay.update()
    }
  }

  persist = () => {
    this.props.onChange({
      x: this.image.x,
      y: this.image.y,
      zoom: this.image.scale.y
    })

    if (this.shouldResolutionChange(this.image.scale.y)) {
      this.handleResolutionChange()
    }
  }

  setContainer = (container) => {
    this.container = container
  }

  // On low-res screens, we render at 2x resolution
  // when zooming out to improve quality. See #218
  shouldResolutionChange(scale) {
    let dppx = round(devicePixelRatio)
    let res = this.pixi.renderer.resolution
    return (dppx === 1) && (scale < 1 ? res === 1 : res === 2)
  }

  handleResolutionChange = () => {
    let dppx = round(devicePixelRatio)
    let { image } = this

    if (dppx === 1 && image != null && image.scale.y < 1) dppx = 2

    this.pixi.renderer.resolution = dppx
    this.pixi.renderer.plugins.interaction.resolution = dppx

    if (this.pixi.renderer.rootRenderTarget) {
      this.pixi.renderer.rootRenderTarget.resolution = dppx
    }

    if (image != null) {
      image.handleResolutionChange(dppx)
    }

    this.resize(bounds(this.container))
  }

  handleLoadProgress = () => {
  }

  handleLoadError = (loader, resource) => {
    if (this.props.onLoadError) {
      this.props.onLoadError({ resource })
    }
  }

  handleWheel = (e) => {
    e.stopPropagation()
    this.props.onWheel(coords(e))
    this.start()
    this.stop()
  }

  handleMouseDown = (event) => {
    const { data, target } = event

    if (this.isDragging) this.drag.stop()
    if (!data.isPrimary) return

    this.start()

    if (target.cursor === TOOL.POLYGON) {
      this.image.on('mouseup', this.handleMouseUp)
      this.image.on('mousemove', this.handleMouseMove)
      on(document.body, 'keydown', this.onPolygonKeyDown)
      let point = data.getLocalPosition(target)
      this.polygonStartTime = performance.now()
      return this.image.polygons.drawLayerPoint({ point: point })
    }

    if (target instanceof Polygon) {
      return this.props.onSelectionActivate(target.data)
    }

    if (target instanceof Selection) {
      return this.props.onSelectionActivate(target.data)
    }

    if (this.isDoubleClick()) {
      return this.props.onDoubleClick(coords(data.originalEvent))
    }

    target.cursor = `${this.props.tool}-active`

    this.drag.start()
    this.drag.current = {
      data,
      target,
      tool: this.props.tool,
      origin: {
        pos: { x: target.x, y: target.y },
        mov: data.getLocalPosition(target.parent)
      },
      selection: data.getLocalPosition(target),
      limit: this.getInnerBounds()
    }
  }

  handleMouseMove = (event) => {
    const { data, target } = event
    if(!this.image.polygons.complete){
      if (target && target.cursor === TOOL.POLYGON) {
        let point = data.getLocalPosition(target)
        return this.image.polygons.drawLayerLine({ point: point })
      }
    }
  }

  onPolygonKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      return this.image.polygons.cancelPolygonDraw()
    }
  }

  handleMouseUp = debounce(() => {
    if (this.image.polygons.complete) {
      let rect = this.image.polygons.rect
      this.props.onSelectionCreate({
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
        polygon: JSON.stringify(this.image.polygons.points),
        color: this.props.shapeColor,
        status: SELECTION.STATUS.NEW,
        spendTime: (performance.now() - this.polygonStartTime).toFixed(2)
      })
      this.image.polygons.complete = false
      this.image.polygons.points = []
      this.image.off('mousemove')
      this.image.off('mouseup')
      off(document.body, 'keydown', this.onPolygonKeyDown)
    }
  }, 200)

  handleDragStop = (_, wasCancelled) => {
    try {
      if (this.isDragging) {
        const { origin, target, tool } = this.drag.current
        target.cursor = this.props.tool

        switch (tool) {
          case TOOL.ARROW:
          case TOOL.PAN:
            this.handlePanStop()
            break
          case TOOL.SELECT:
            this.handleSelectStop(wasCancelled)
            break
          case TOOL.ZOOM_IN:
            if (!wasCancelled) this.props.onZoomIn(origin.mov)
            break
          case TOOL.ZOOM_OUT:
            if (!wasCancelled) this.props.onZoomOut(origin.mov)
            break
        }
      }

    } finally {
      this.drag.current = undefined
      this.stop()
    }
  }

  handleDrag = () => {
    if (this.isDragging) {
      switch (this.drag.current.tool) {
        case TOOL.ARROW:
        case TOOL.PAN:
          this.handlePanMove()
          break
        case TOOL.SELECT:
          this.handleSelectMove()
          break
      }
    }
  }

  handlePanMove() {
    const { data, limit, origin, target } = this.drag.current
    const { pos, mov } = origin
    const { top, right, bottom, left } = limit
    const { x, y } = data.getLocalPosition(target.parent)
    target.x = floor(restrict(pos.x + (x - mov.x), left, right))
    target.y = floor(restrict(pos.y + (y - mov.y), top, bottom))
  }

  handlePanStop() {
    this.persist()
  }

  handleSelectMove() {
    const { data, target } = this.drag.current
    const { selection } = this.drag.current
    const { x, y } = data.getLocalPosition(target)
    selection.width = x - selection.x
    selection.height = y - selection.y
  }

  handleSelectStop(wasCancelled) {
    const { width: maskWidth, height: maskHeight } = this.image.overlay
    let { x, y, width, height } = this.drag.current.selection

    if (wasCancelled || !width || !height) return
    if (this.props.selection != null) return

    if (width < 0) {
      x = x + width
      width = -width
    }

    if (height < 0) {
      y = y + height
      height = -height
    }
    let newX = x
    let newY = y
    let newWidth = width
    let newHeight = height

    if (x < 0) {
      newX = 0
      newWidth = width + x
    }
    if (y < 0) {
      newY = 0
      newHeight = height + y
    }
    if ((x + width) > maskWidth) {
      newWidth = maskWidth - x
    }
    if ((y + height) > maskHeight) {
      newHeight = maskHeight - y
    }

    this.props.onSelectionCreate({
      x: round(newX),
      y: round(newY),
      width: round(newWidth),
      height: round(newHeight),
      color: this.props.shapeColor,
      status: SELECTION.STATUS.NEW,
      spendTime: (performance.now() - this.selectionStartTime).toFixed(2)
    })
  }

  drag = createDragHandler(this)

  render() {
    return (
      <div ref={this.setContainer} className="esper-view"/>
    )
  }

  static propTypes = {
    selection: object,
    selections: array.isRequired,
    polygons: array.isRequired,
    tool: string.isRequired,
    shapeColor: string.isRequired,
    onChange: func.isRequired,
    onDoubleClick: func.isRequired,
    onLoadError: func,
    onPhotoError: func.isRequired,
    onSelectionCreate: func.isRequired,
    onSelectionActivate: func.isRequired,
    onWheel: func.isRequired,
    onZoomIn: func.isRequired,
    onZoomOut: func.isRequired
  }
  static defaultProps = {
    shapeColor: '5c93e5'
  }
}


function coords(e) {
  return {
    x: e.offsetX,
    y: e.offsetY,
    dx: e.deltaX,
    dy: e.deltaY,
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey
  }
}

function equal(p1, p2) {
  return p1.x === p2.x && p1.y === p2.y
}


function svg(name) {
  return [`esper/${name}@1x.svg`, `esper/${name}@2x.svg`]
}

function addCursorStyle(styles, name, cursor = CURSOR[name]) {
  if (cursor == null) return

  styles[name] = css.cursor(svg(cursor.default), cursor)
  styles[`${name}-active`] = css.cursor(svg(cursor.active), cursor)
}

module.exports = {
  EsperView
}
