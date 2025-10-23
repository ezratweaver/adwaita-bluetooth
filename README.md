<h1>
<p align="center">
  <br>Adwaita Bluetooth
</h1>
<p align="center">
    A GNOME inspired Bluetooth device manager built with GTK4 and Libadwaita.
    <br />
</p>
</p>

## About This Project

A Bluetooth device manager built for tiling window managers like Hyprland and Niri. For NixOS and Arch Linux users who want GNOME's Bluetooth functionality without the full GNOME desktop.

## TODOs

- [ ] Implement multi adapter support
- [ ] Implement File transfer
- [ ] Implement handling for rfkill

## Development

### Using Nix (Recommended)

Enter the development environment with all dependencies:

```bash
nix develop
```

### Build Steps

```bash
meson setup builddir
meson compile -C builddir

# For running locally
meson compile -C builddir devel
```
