{
  description = "VocoSphere development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        ffmpegVersion = "b6.1.1";
        ffmpegBase = "https://github.com/eugeneware/ffmpeg-static/releases/download/${ffmpegVersion}";

        # nix system → Rust target triple + 下载 asset 名
        ffmpegAsset = {
          "aarch64-darwin"  = { triple = "aarch64-apple-darwin";      asset = "ffmpeg-darwin-arm64"; };
          "x86_64-darwin"   = { triple = "x86_64-apple-darwin";       asset = "ffmpeg-darwin-x64";   };
          "aarch64-linux"   = { triple = "aarch64-unknown-linux-gnu";  asset = "ffmpeg-linux-arm64";  };
          "x86_64-linux"    = { triple = "x86_64-unknown-linux-gnu";   asset = "ffmpeg-linux-x64";    };
        }.${system} or null;
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.ffmpeg pkgs.curl ];

          shellHook =
            if ffmpegAsset == null then ''
              echo "⚠ unsupported system: ${system}"
            '' else ''
              SIDECAR="src-tauri/binaries/${ffmpegAsset.triple}"
              if [ ! -f "$SIDECAR" ]; then
                mkdir -p src-tauri/binaries
                echo "⬇ downloading ffmpeg sidecar (${ffmpegAsset.asset})..."
                curl -L -o "$SIDECAR" "${ffmpegBase}/${ffmpegAsset.asset}"
                chmod +x "$SIDECAR"
                echo "✓ ffmpeg sidecar ready: $SIDECAR"
              fi
            '';
        };
      }
    );
}
