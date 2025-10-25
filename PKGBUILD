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
  "git+https://github.com/ezratweaver/${pkgname}#tag=${pkgver/[a-z]/.&}"
)
b2sums=('75c9599d1fb69688754df976e43e53c252dc4ccc3ecd5de5c83dd90cfdf339f943a375f0607890b7215f8b81327943bd282aa93008e10c5a03e8af4bd105c5d8')

build() {
  arch-meson $pkgname build
  meson compile -C build
}

package() {
  meson install -C build --destdir "$pkgdir"
  ln -s com.eweaver.adw_bluetooth "$pkgdir/usr/bin/adw-bluetooth"
}
