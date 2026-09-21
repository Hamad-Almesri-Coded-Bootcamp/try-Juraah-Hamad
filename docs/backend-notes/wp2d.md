# WP2d — Navigation + Overlays

No component in this group reads a data-contract field, so nothing is owed to §4. §7 items only:

1. **`AppBarProps`, `SheetProps` narrowed to discriminated unions.** `index.d.ts` declares
   `backLabel?: string` / `closeLabel?: string` as plain optional fields on a flat interface, but
   both are icon-only controls' accessible names, which UX §11 says must come from a prop, never a
   literal — so there is no safe built-in fallback. `AppBar` and `Sheet` narrow their exported prop
   types to discriminated unions (`onBack`/`backHref` ⇒ `backLabel` required; `onClose` ⇒
   `closeLabel` required) rather than leaving the requirement as a comment. No prop was added,
   removed or renamed; every union branch still structurally satisfies the flat shape `index.d.ts`
   declares. The WP2d brief itself asked for this treatment on `AppBar`; the same reasoning was
   extended to `Sheet`'s `closeLabel`, since it is the identical situation and `Sheet`, like
   `AppBar` and `TabBar`, carries no `lang` prop to resolve a vocabulary fallback from.

2. **`TabBar`'s one prop addition: `href?: string` on an item.** Recorded per the brief. App Router
   navigation cannot be expressed through `onChange` alone (`index.d.ts`'s only other prop), so an
   item with `href` renders as a real `<a>`; `onChange` still fires on click when supplied, so a
   consumer can keep local `value` state synced with the route.

3. **`TabBar.items` is a `[T,T] | [T,T,T] | [T,T,T,T]` tuple union**, not `Array<T>`. A 5th item is
   therefore a compile-time error (`components/ui/TabBar.test.tsx` has a `@ts-expect-error` case
   proving it), matching the WP2d brief and TabBar.md's "For more than the shell's own item count…
   the overflow is المزيد". A tuple is structurally assignable wherever `Array<T>` is expected, so
   this is a narrowing, not a contract change.

4. **`TabBar` badge accessible name.** A badge's glyph is `aria-hidden`; the control's accessible
   name becomes `"{item.label} {item.badge}"`, built only from the consumer's own `label` and the
   numeral — no invented word ("items", "due", …) was introduced, since `TabBar` has no vocabulary
   fallback to draw one from.

5. **Motion gap on `Sheet`.** The WP2d brief calls for "240ms motion collapsing under reduced
   motion" on open/close. `docs/design-system/bundle.css`'s Sheet section defines no transition or
   animation at all (only `Button`'s spinner, `Toggle`'s knob and `LoadingState`'s skeleton pulse
   get motion anywhere in the bundle). Per the common brief, a ported component "adds no CSS of its
   own", so no transition was added; `Sheet` opens and closes without animation, exactly as the
   bundle ships it. Flagged for the owner rather than invented — this is a genuine gap between the
   WP2d brief's prose and `bundle.css` as it stands, not a build choice.

6. **IconButton stand-in.** group a's `IconButton` did not exist yet at the time of this port
   (checked: only `components/ui/Icon.tsx` and `components/ui/styles/bundle.css` existed under
   `components/ui/` when WP2d started). `AppBar`'s back control and `Sheet`'s close control use the
   plain-element stand-in the common brief allows, with the fuller class list that reproduces
   `IconButton.md`'s actual anatomy — `wsf-btn wsf-btn--quiet wsf-iconbtn wsf-focus` — rather than
   the brief's literal, minimal `<button class="wsf-iconbtn wsf-focus">` snippet, since `.wsf-iconbtn`
   alone carries no colour, border-radius or centring in `bundle.css`. Swap in the real `IconButton`
   once group a ships it; no prop or behaviour changes.

7. **Gallery Sheet examples default closed.** `docs/design-system/components/Sheet.md` itself says
   "Two at once… one decision at a time", and `Sheet` locks page-level body scroll for as long as it
   is open. Rendering several `Sheet`s permanently open on one gallery page would violate that rule
   and make the gallery page itself unscrollable, so each gallery Sheet example is closed by default
   with its own trigger and local state; the full open/focus-trap/Escape/scrim/restore-focus contract
   is exercised directly (and more thoroughly) by `components/ui/Sheet.test.tsx`.
