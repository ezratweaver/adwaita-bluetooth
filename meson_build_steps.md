meson setup builddir
meson compile -C builddir

# For running locally

meson compile -C builddir devel
