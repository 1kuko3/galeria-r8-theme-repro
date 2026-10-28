# Android: `theme` prop is ignored in R8-minified release builds (`Theme` enum is not `Enumerable`)

## Summary

On Android release builds with R8 on (the default in Expo SDK 58), setting `theme` on
`<Galeria>` fails. The fullscreen viewer always uses the default dark theme, so
`theme="light"` has no effect.

## Versions

- `@nandorojo/galeria` 3.1.0 (the code on `master` is the same)
- `expo` 58.0.19 / `expo-modules-core` 58.0.27, `react-native` 0.88.0
- Pixel 7a, Android 17

## Repro

```tsx
<Galeria urls={[url]} theme="light">
  <Galeria.Image index={0}>
    <Image source={{ uri: url }} style={{ width: 300, height: 200 }} />
  </Galeria.Image>
</Galeria>
```

Make a release build with `android.enableMinifyInReleaseBuilds=true`, then tap the image.
The viewer is black. With minification off, the viewer is white.

Logcat:

```
E ExpoModulesCore: Enum 'z34' should inherit from class expo.modules.kotlin.types.Enumerable.
E ExpoModulesCore: ❌ Cannot set the 'Galeria' prop on the 'nandorojo.modules.galeria.GaleriaView{...}'
E ExpoModulesCore: od: Cannot set prop 'theme' on view 'class nandorojo.modules.galeria.GaleriaView'
E ExpoModulesCore: → Caused by: 'light' is not present in z34 enum, it must be one of: 'Dark', 'Light'
```

Debug builds also log `Enum 'Theme' should inherit from class expo.modules.kotlin.types.Enumerable.`

## Cause

`enum class Theme(val value: String)` in `GaleriaView.kt` does not implement
`expo.modules.kotlin.types.Enumerable`. Expo's `EnumTypeConverter` finds the `value`
field with reflection. The only matching rule in expo-modules-core's consumer ProGuard
rules is:

```proguard
-keep enum * implements expo.modules.kotlin.types.Enumerable { *; }
```

No rule keeps `Theme`, so R8 removes `value`, because Kotlin code never reads it. The
converter then falls back to matching constant names (`Dark`/`Light`), and `"light"`
does not match.

## Fix

```kotlin
import expo.modules.kotlin.types.Enumerable

enum class Theme(val value: String) : Enumerable { ... }
```

I tested this on a device: with this change, the R8 release build shows a white viewer
and logs no errors. I can open a PR.
