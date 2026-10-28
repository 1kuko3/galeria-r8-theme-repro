# galeria-r8-repro

A minimal reproduction: in an R8-minified Android release build, `@nandorojo/galeria`
ignores the `theme` prop.

The repo starts in the **broken** state. The fix is in `patches/`, but it is not applied
automatically (there is no `postinstall` script).

## Environment

| | |
|---|---|
| Expo | `expo@58.0.19` (`expo-modules-core@58.0.27`) |
| React Native | 0.88.0 (React 19.3.0) |
| Galeria | `@nandorojo/galeria@3.1.0` |
| Image | `expo-image@~58.0.17` |
| Device | Pixel 7a, Android 17 (physical device, USB) |
| Host | macOS, Node 22.22.0, JDK 17, Gradle 9.4.1 |

Minification: the SDK 58 template turns R8 on for release by default.
`expo prebuild` writes `android.enableMinifyInReleaseBuilds=true` to
`android/gradle.properties`, so no `expo-build-properties` config is needed.

## Steps

```bash
npm install
npx expo prebuild -p android
cd android && ./gradlew :app:assembleRelease   # release build signed with the debug keystore
adb install -r app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb shell am start -n com.example.galeriar8repro/.MainActivity
# tap the image
adb logcat -d | grep ExpoModulesCore
```

(`npx expo run:android --variant release --device` also works.)

`App.tsx` renders `<Galeria urls={[url]} theme="light">` around one `<Galeria.Image index={0}>`.

## Expected vs. actual

- **Expected:** `theme="light"` makes the fullscreen viewer background white.
- **Actual (R8 release):** the viewer is black, which is the default `Theme.Dark`, and
  Expo logs an error when it sets the prop.

| Build | Viewer | Screenshot |
|---|---|---|
| Release, R8 on (default) | black (broken) | `evidence/broken-2-viewer.png` |
| Release, R8 off (`-Pandroid.enableMinifyInReleaseBuilds=false`) | white | `evidence/nominify-viewer.png` |
| Release, R8 on, plus the patch | white | `evidence/fixed-2-viewer.png` |

### Logcat (R8 release, unpatched)

```
E ExpoModulesCore: Enum 'z34' should inherit from class expo.modules.kotlin.types.Enumerable.
E ExpoModulesCore: ❌ Cannot set the 'Galeria' prop on the 'nandorojo.modules.galeria.GaleriaView{8f33998 V.E...... ......I. 0,0-0,0 #8}'
E ExpoModulesCore: od: Cannot set prop 'theme' on view 'class nandorojo.modules.galeria.GaleriaView'
E ExpoModulesCore: → Caused by: 'light' is not present in z34 enum, it must be one of: 'Dark', 'Light'
```

Without R8, only the warning shows (`Enum 'Theme' should inherit from class
expo.modules.kotlin.types.Enumerable.`). The conversion still works there.
With the patch, neither line shows. See `evidence/logcat-*.txt`.

## Root cause

`GaleriaView.kt` declares:

```kotlin
enum class Theme(val value: String) { Dark("dark"), Light("light"); ... }
```

and `GaleriaModule.kt` uses it as `Prop("theme") { view: GaleriaView, theme: Theme -> ... }`.

Expo's `EnumTypeConverter` (`expo-modules-core/android/.../types/EnumTypeConverter.kt`)
finds the enum's parameter with reflection:
`enumClass.declaredFields.filter { !Modifier.isStatic(it.modifiers) && !it.isSynthetic }`.
- With one such field, it matches the JS string against that field's value (`"light"`).
- With no such field, it matches the JS string against the constant **names** (`Dark`, `Light`).

The only keep rule in `node_modules/expo-modules-core/android/proguard-rules.pro`
that covers converted enums is:

```proguard
-keep enum * implements expo.modules.kotlin.types.Enumerable {
  *;
}
```

`Theme` does not implement `Enumerable`, so no rule keeps it. R8 sees that Kotlin code
never reads `value`, so it removes the field and renames the class to `z34`. The R8
mapping (`android/app/build/outputs/mapping/release/mapping.txt`) shows `Theme -> z34`
with no `value` field. At runtime the converter finds no instance fields and falls back
to name matching. `"light"` does not equal `"Light"`, so the prop setter throws, and the
view keeps `Theme.Dark`.

## Fix

Make `Theme` implement `Enumerable` (see `fix/GaleriaView-Enumerable.diff` and
`patches/@nandorojo+galeria+3.1.0.patch`):

```diff
+import expo.modules.kotlin.types.Enumerable
 ...
-enum class Theme(val value: String) {
+enum class Theme(val value: String) : Enumerable {
```

With the fix, the existing keep rule matches the enum. The mapping shows
`Theme -> nandorojo.modules.galeria.Theme` with `getValue` kept. The viewer is white and
no error is logged.

`Theme` is the only enum that galeria's Android code uses as a prop or record field
(upstream `master` @ `b6f38e3`). It has no `Record` classes.

### Apply the fix to this repro

```bash
npx patch-package          # applies patches/@nandorojo+galeria+3.1.0.patch
cd android && ./gradlew :app:assembleRelease
# undo: npx patch-package --reverse
```

## Other files

- `ISSUE.md`: draft GitHub issue for nandorojo/galeria
- `PR.md`: draft PR title and body
- `fix/GaleriaView-Enumerable.diff`: diff against upstream `master` (`fix/UPSTREAM.txt` has the commit)
