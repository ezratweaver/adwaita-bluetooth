


<h1>
<p align="center">
  <img width="80" height="100" alt="bluetooth" src="https://github.com/user-attachments/assets/f9f9e18c-2cd3-48f6-a465-d228b2f223c3" />
  <br>
  <br>
  Adwaita Bluetooth
</h1>
<p align="center">
    A GNOME inspired Bluetooth device manager built with GTK4 and Libadwaita.
    <br />
</p>
</p>

<img width="1920" height="1080" alt="2025-10-24-012814_hyprshot" src="https://github.com/user-attachments/assets/e99347a2-7ced-42cf-940a-8d1046afdb76" />


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

#### Using Nix

```bash
nix build
```

#### Using Meson

```bash
meson setup builddir
meson compile -C builddir

# For running locally
meson compile -C builddir devel
```
