// The panel's own state, never stored with the photo: how many Graduated
// Density panels show, whether the line is on the photo to be edited (the
// overlay draws it only while both hold and the filter is on), and the mask
// whose sub-panel shows (the line then edits that mask's filter).

import { api } from "./rt";
import type { AppStore, ParamScope } from "./safelight";

export interface GraduatedUi {
  panels: number;
  /** The line is on the photo: from switching the filter on, choosing a
   *  preset, turning or shifting it, or Edit Line, until Done, Escape or the
   *  last panel closing. */
  editing: boolean;
  /** The scope of the mask whose sub-panel shows; null for the photo. */
  scope: ParamScope | null;
  edit(on: boolean): void;
  panelShown(shown: boolean): void;
  /** The line edits the filter of `scope` (null: the photo's). */
  editScope(scope: ParamScope | null): void;
  /** Mask `maskId`'s sub-panel went: the line edits the photo's filter again,
   *  unless another mask's sub-panel showed meanwhile. */
  leaveMask(maskId: string): void;
}

let instance: AppStore<GraduatedUi> | null = null;

export function initStore(): void {
  instance = api.stores.create<GraduatedUi>()((set) => ({
    panels: 0,
    editing: false,
    scope: null,
    edit: (editing) => set({ editing }),
    panelShown: (shown) =>
      set((s) => {
        const panels = Math.max(0, s.panels + (shown ? 1 : -1));
        return panels === 0 ? { panels, editing: false } : { panels };
      }),
    editScope: (scope) => set({ scope }),
    leaveMask: (maskId) => set((s) => (s.scope?.maskId === maskId ? { scope: null } : {})),
  }));
}

export function store(): AppStore<GraduatedUi> {
  if (!instance) throw new Error("Graduated Density's store is used before activate()");
  return instance;
}
