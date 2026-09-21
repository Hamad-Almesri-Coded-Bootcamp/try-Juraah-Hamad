/** Guard 2 — no hard-coded hex colour, px font size or px radius in components/, app/, features/. */
import { walk, scan, isDevSurface, type GuardResult, UI_DIRS } from './_shared';

export function run(): GuardResult {
  const files = UI_DIRS.flatMap((d) => walk(d, ['.ts', '.tsx', '.css'])).filter((f) => !isDevSurface(f));
  const v = [
    ...scan(files, 'hex colour', /#[0-9a-fA-F]{3,8}\b(?![\w-])/, (l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/https?:\/\//.test(l)),
    ...scan(files, 'px font-size', /font-size\s*:\s*\d+(\.\d+)?px|\bfontSize\s*:\s*['"]?\d+(\.\d+)?px/),
    ...scan(files, 'px font-size (tailwind)', /\btext-\[\d+(\.\d+)?px\]/),
    ...scan(files, 'px radius', /border(-[a-z-]+)?-radius\s*:\s*\d+(\.\d+)?px|\bborder[A-Z][a-zA-Z]*Radius\s*:\s*['"]?\d+(\.\d+)?px/),
    ...scan(files, 'px radius (tailwind)', /\brounded(-[a-z]+)?-\[\d+(\.\d+)?px\]/),
  ];
  // app/manifest.ts legitimately carries theme_color / background_color for the OS, not for a screen.
  return {
    name: 'guard 2 · no raw hex / px font-size / px radius in ui code',
    violations: v.filter((x) => !(x.file === 'app/manifest.ts' && x.rule === 'hex colour') && !(x.file === 'app/[locale]/layout.tsx' && x.rule === 'hex colour' && /themeColor/.test(x.text))),
    notes: ['exempt by design: app/manifest.ts theme colours (OS chrome, not a screen); the dev gallery under app/(dev)/'],
  };
}
