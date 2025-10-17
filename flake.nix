{
  description = "Flake for adw-bluetooth applet";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          pkgs.git
          pkgs.pkg-config
          pkgs.gobject-introspection
          pkgs.gtk4
          pkgs.libadwaita
          pkgs.gnome-themes-extra
          pkgs.meson
          pkgs.ninja
          pkgs.gnome-builder
          pkgs.gjs
          pkgs.blueprint-compiler
          pkgs.typescript
          pkgs.desktop-file-utils
          pkgs.librsvg
        ];

      };
    };
}
