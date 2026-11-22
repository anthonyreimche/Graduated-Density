// Where an edit of the filter goes: the open photo's, through the develop
// store, or a mask's, through the param scope its sub-panel was given. The
// panel and the line on the canvas change the same values this way. A live
// change writes the keys it touched; a gesture ends with one commit, one undo
// step.

import type { Params } from "./model";
import { MASK_STAGE_ID, STAGE_ID, bagPatch, readParams, type StageId } from "./params";
import { api } from "./rt";
import type { ParamScope } from "./safelight";
import { store } from "./store";

export const TITLE = "Graduated Density";

export interface Target {
  stage: StageId;
  read(): Params;
  /** Writes `keys` of `next`, live. */
  write(next: Params, keys: readonly (keyof Params)[]): void;
  commit(what: string): void;
}

const label = (what: string) => `${TITLE}: ${what}`;

export const photoTarget: Target = {
  stage: STAGE_ID,
  read: () => readParams(api.stores.useDevelopStore.getState().paramBag, STAGE_ID),
  write: (next, keys) => api.stores.useDevelopStore.getState().setDynParams(bagPatch(next, STAGE_ID, keys)),
  commit: (what) => void api.stores.useDevelopStore.getState().commitEdit(label(what)),
};

/** A scope's filter: the photo's in the dock, a mask's in the Masking panel.
 *  Reads see the scope as it is now, so a drag's steps build on each other. */
export function scopeTarget(scope: ParamScope): Target {
  const stage = scope.maskId === null ? STAGE_ID : MASK_STAGE_ID;
  return {
    stage,
    read: () => readParams(scope.getParams(), stage),
    write: (next, keys) => scope.setParams(bagPatch(next, stage, keys)),
    commit: (what) => scope.commit(label(what)),
  };
}

/** What the line on the canvas edits: the mask whose sub-panel shows, else the photo. */
export function editing(): Target {
  const scope = store().getState().scope;
  return scope ? scopeTarget(scope) : photoTarget;
}
