/// @anchor: napi-rs build script — https://napi.rs/docs/introduction/getting-started
/// Génère les fichiers nécessaires au binding Node.js natif.

#[cfg(feature = "napi")]
extern crate napi_build;

fn main() {
    #[cfg(feature = "napi")]
    napi_build::setup();
}
