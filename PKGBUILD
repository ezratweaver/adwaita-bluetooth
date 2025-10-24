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
b2sums=('330e92db065cdcb78738fe4dd25a6d7efb47274ef4b8590f69c72ad7e0c744fea07b3485949c6b15e1e0b0196b1f977a76ab6b6d28b4a76501c4a55f0c273209'
)

build() {
  arch-meson $pkgname build
  meson compile -C build
}

package() {
  meson install -C build --destdir "$pkgdir"
  ln -s com.eweaver.adw_bluetooth "$pkgdir/usr/bin/adw-bluetooth"
}
