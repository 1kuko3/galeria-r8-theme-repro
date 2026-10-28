# fix(android): make `Theme` implement `Enumerable` so `theme` survives R8

## Summary

`Theme` is used as a view prop type (`Prop("theme") { view, theme: Theme -> }`), but it
does not implement `expo.modules.kotlin.types.Enumerable`. Expo's `EnumTypeConverter`
finds the enum's `value` field with reflection. expo-modules-core only keeps that field
for `enum * implements expo.modules.kotlin.types.Enumerable`. In R8-minified release
builds (the default in Expo SDK 58), R8 removes `value`. Every `theme` value then fails
to convert:

```
E ExpoModulesCore: Cannot set prop 'theme' on view 'class nandorojo.modules.galeria.GaleriaView'
E ExpoModulesCore: → Caused by: 'light' is not present in z34 enum, it must be one of: 'Dark', 'Light'
```

As a result, `theme="light"` is ignored on Android and the viewer stays black.

This PR adds `: Enumerable` to `Theme`, which is what Expo's converter expects. This also
removes the `Enum 'Theme' should inherit from ...Enumerable` warning in debug builds.
`Theme` is the only enum in the Android sources that is used as a prop or record field.

Closes #<issue>

## Changes

```diff
+import expo.modules.kotlin.types.Enumerable
 ...
-enum class Theme(val value: String) {
+enum class Theme(val value: String) : Enumerable {
```

## Test plan

- [x] Expo 58.0.19 / RN 0.88 app on a Pixel 7a. Release build with `android.enableMinifyInReleaseBuilds=true`, `<Galeria theme="light">`
  - Before: black viewer, plus the logcat error above
  - After: white viewer, no `ExpoModulesCore` errors. The R8 mapping keeps `Theme` and `getValue`
- [x] Release build without minification: white viewer before and after (only the debug warning goes away)
