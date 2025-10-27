# Maintainer: Ezra Weaver <ezratweaver@gmail.com>
pkgname=adw-bluetooth
pkgver=0.1.0
pkgrel=1
pkgdesc='GNOME Inspired LibAdwaita Bluetooth Applet'
arch=(any)
license=(GPL-3.0)
depends=(
  dconf
  gjs
  glib2
  gtk4
  hicolor-icon-theme
  libadwaita
)
makedepends=(
  blueprint-compiler
  git
  meson
  typescript
)
source=(
  "git+https://github.com/ezratweaver/${pkgname}"
)
b2sums=('SKIP')

build() {
  arch-meson $pkgname build
  meson compile -C build
}

package() {
  meson install -C build --destdir "$pkgdir"
  ln -s com.ezratweaver.AdwBluetooth "$pkgdir/usr/bin/adw-bluetooth"
}
