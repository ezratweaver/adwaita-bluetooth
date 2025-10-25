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

> [!WARNING]
> This project is a work in progress

![adw-bluetooth](https://github.com/user-attachments/assets/67b1ae9d-0c9c-4a8b-8810-42c1d0ec1d9b)

## About This Project

A Bluetooth device manager built for tiling window managers like Hyprland and Niri. For NixOS and Arch Linux users who want GNOME's Bluetooth functionality without the full GNOME desktop.

### Roadmap

- [ ] Multi-adapter support
- [ ] File transfer capabilities
- [ ] Rfkill handling

## Installation

### Arch Linux (AUR)

```bash
yay -S adw-bluetooth
```

### NixOS (Flake only)

Add input to the flake:

```nix
adw-bluetooth.url = "github:ezratweaver/adwaita-bluetooth";
```

And in environment.systemPackages add:

```nix
inputs.adw-bluetooth.packages.${system}.default
```


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
