'use strict'

require('shelljs/make')

const { say, error } = require('./util')('build')
const electron = require('electron/package')
const packager = require('electron-packager')
const { basename, extname, join, resolve, relative } = require('path')
const { desktop } = require('../lib/common/os')
const {
  author, channel, name, version, qualified
} = require('../lib/common/release')

const dir = resolve(__dirname, '..')
const res = join(dir, 'res')
const icons = resolve(res, 'icons', channel, 'tropy')
const mime = resolve(res, 'icons', 'mime')

const SHARP = join('node_modules', 'sharp', 'vendor', 'lib')

const IGNORE = [
  /.DS_Store/,
  /.babelrc.js/,
  /.editorconfig/,
  /.eslintrc/,
  /.gitignore/,
  /.nvmrc/,
  /.nyc_output/,
  /.sass-lint\.yml/,
  /.travis\.yml/,
  /.vimrc/,
  /^\/coverage/,
  /^\/db.test/,
  /^\/dist/,
  /^\/doc/,
  /^\/ext/,
  /^\/res.ext/,
  /^\/res.mime/,
  /^\/res.icons.dev/,
  /^\/res.icons.beta/,
  /^\/res.icons.stable/,
  /^\/res.icons.mime/,
  /^\/res.dmg/,
  /^\/res.linux/,
  /^\/res.ext\.plist/,
  /^\/scripts/,
  /^\/src/,
  /^\/test/,
  /^\/tmp/,
  /node_modules.\.bin/,
  /node_modules.rdf-canonize.build.Release.urdna2015\.node/,
  /node_modules.prosemirror-model.dist.index\.js\.map/,
  /node_modules.sharp.build.[^R]/,
  /node_modules.sharp.build.Release.obj/,
  /node_modules.sharp.vendor.include/,
  /appveyor\.yml/
]

target.all = async (args = []) => {
  try {

    const platform = args[0] || process.platform
    const arch = args[1] || process.arch
    const ignore = [...IGNORE]

    const icon = platform === 'win32' ?
      join(res, 'icons', channel, `${name}.ico`) :
      join(res, 'icons', channel, `${name}.icns`)

    say(`packaging for ${platform} ${arch}...`)

    if (platform !== 'win32') {
      ignore.push(/^\/node_modules.winreg/)
    }

    const extraResource = (platform !== 'darwin') ? [] : [
      join(res, 'icons', 'mime', 'tpy.icns'),
      join(res, 'icons', 'mime', 'ttp.icns')
    ]

    let dst = await packager({
      platform,
      arch,
      icon,
      dir,
      out: join(dir, 'dist'),
      name: qualified.product,
      prune: true,
      overwrite: true,
      quiet: true,
      ignore,
      electronVersion: electron.version,
      appVersion: version,
      appBundleId: 'org.tropy.tropy',
      helperBundleId: 'org.tropy.tropy-helper',
      appCategoryType: 'public.app-category.productivity',
      appCopyright:
        `Copyright (c) 2015-${new Date().getFullYear()} ` +
        `${author.name}. All rights not expressly granted are reserved.`,
      extendInfo: join(res, 'ext.plist'),
      extraResource,
      darwinDarkModeSupport: true,
      win32metadata: {
        CompanyName: author.name,
        ProductName: qualified.product
      },
      asar: {
        unpack: '**/{*.node,lib/stylesheets/**/*,res/icons/mime/*.ico,res/menu/*,res/strings/*,res/keymaps/*,sharp/{build/Release,vendor/lib}/*}',
      }

    })

    dst = String(dst)

    switch (platform) {
      case 'linux': {
        let unpacked = join(dst, 'resources', 'app.asar.unpacked')

        if (test('-d', unpacked)) {
          say('fix unpacked symlinks...')
          cp('-r', join(dir, SHARP, '*'), join(unpacked, SHARP))
        }

        say(`rename executable to ${qualified.name}...`)
        rename(dst, qualified.product, qualified.name)

        say('create .desktop file...')
        desktop().to(join(dst, `${qualified.name}.desktop`))

        say('copy icons...')
        copyIcons(dst)

        say('copy mime types...')
        mkdir('-p', join(dst, 'mime', 'packages'))
        cp(join(res, 'mime', '*.xml'), join(dst, 'mime', 'packages'))

        say('copy installation instructions...')
        cp(join(res, 'INSTALL'), dst)

        break
      }
      case 'darwin': {
        let unpacked = join(dst,
            `${qualified.product}.app`,
            'Contents',
            'Resources',
            'app.asar.unpacked')

        if (test('-d', unpacked)) {
          say('fix unpacked symlinks...')
          cp('-r', join(dir, SHARP, '*'), join(unpacked, SHARP))
        }
        break
      }
      case 'win32': {
        say('removing duplicate DLLs...')
        rm(join(dst, 'resources', 'app.asar.unpacked', SHARP, '*.dll'))

        say(`renaming executable to ${qualified.name}.exe...`)
        rename(dst, `${qualified.product}.exe`, `${qualified.name}.exe`)
      }
    }

    say(`saved app to ${relative(dir, dst)}`)

  } catch (err) {
    error(err)
  }
}

function rename(ctx, from, to) {
  mv(join(ctx, from), join(ctx, to))
}

function copyIcons(dst) {
  const theme = resolve(dst, 'icons', 'hicolor')

  for (let icon of ls(icons)) {
    let ext = extname(icon)
    let variant = basename(icon, ext)
    let target = join(theme, variant, 'apps')

    let file = (variant === 'symbolic') ?
      `${qualified.name}-symbolic${ext}` : `${qualified.name}${ext}`

    mkdir('-p', target)
    cp(join(icons, icon), join(target, file))
  }

  for (let type of ['lbr']) {
    for (let icon of ls(join(mime, type))) {
      let ext = extname(icon)
      let variant = basename(icon, ext)

      if ((/@/).test(variant)) continue

      let target = join(theme, variant, 'mimetypes')
      let file = `application-vnd.tropy.${type}{ext}`

      mkdir('-p', target)
      cp(join(mime, type, icon), join(target, file))
    }
  }
}
