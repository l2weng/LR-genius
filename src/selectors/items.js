'use strict'

const { createSelector: memo } = require('reselect')
const { pluck, pluckSku } = require('./util')
const EMPTY = {}

const getItems = ({ items }) => items

const getSelectedItems = memo(
  ({ items }) => items, ({ nav }) => (nav.items), pluck
)
const getSkuItems = memo(
  ({ items }) => items, ({ nav }) => (nav.items), pluckSku
)

const getVisibleItems = memo(
  ({ items }) => items, ({ qr }) => (qr.items), pluck
)

const getListHold = memo(
  getSelectedItems,
  (items) => items.reduce((hold, item) => {
    for (let list of item.lists) hold[list] = true
    return hold
  }, {})
)

const getSelectedItemTemplate = memo(
  getSelectedItems,
  ([item, ...items]) => (item == null) ? EMPTY : {
    id: item.template,
    mixed: items.find(it => it.template !== item.template) != null
  }
)

module.exports = {
  getItems,
  getSkuItems,
  getListHold,
  getSelectedItems,
  getSelectedItemTemplate,
  getVisibleItems
}
