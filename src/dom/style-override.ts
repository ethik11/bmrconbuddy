interface StyleValue {
  value: string;
  priority: string;
}

interface OverrideState {
  original: StyleValue;
  applied: StyleValue;
}

function readStyle(el: HTMLElement, property: string): StyleValue {
  return {
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  };
}

function sameStyle(a: StyleValue, b: StyleValue): boolean {
  return a.value === b.value && a.priority === b.priority;
}

/**
 * Own an inline override without losing Battlemetrics' original or newer styles.
 * Pass null to restore it. Shorthands must list their longhands so partial inline
 * declarations and their !important priorities survive restoration.
 */
export function createStyleOverride(
  property: string,
  longhands: readonly string[] = [property],
): (el: HTMLElement, value: string | null) => void {
  const overrides = new WeakMap<HTMLElement, OverrideState[]>();

  return (el, value) => {
    const previous = overrides.get(el);
    const current = longhands.map((name) => readStyle(el, name));
    if (value === null) {
      previous?.forEach((state, i) => {
        if (sameStyle(current[i], state.applied)) {
          el.style.setProperty(longhands[i], state.original.value, state.original.priority);
        }
      });
      overrides.delete(el);
      return;
    }

    el.style.setProperty(property, value);
    overrides.set(
      el,
      longhands.map((name, i) => ({
        original:
          previous && sameStyle(current[i], previous[i].applied)
            ? previous[i].original
            : current[i],
        applied: readStyle(el, name),
      })),
    );
  };
}
