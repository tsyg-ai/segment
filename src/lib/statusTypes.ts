/** DTO for a row of `status` (mirrors core::models::Status). */
export interface Status {
  id: number;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isDone: boolean;
  /** Live count of tasks on this status; 0 from endpoints that don't compute it. */
  todoCount: number;
}

/** Functionele kleurenramp voor statussen (mockups `_statussen` /
    `_nieuwe-status`, uitgebreid). De eerste zes zijn de originele ramp —
    nieuwe kleuren staan achteraan zodat bestaande statussen hun kleur
    behouden. Verzadigder dan {@link PROJECT_COLORS}: een status *mag* wel als
    signaal lezen. */
export const STATUS_COLORS: readonly string[] = [
  "#5E6A65", // grijsgroen
  "#96701A", // oker
  "#4A6B8A", // staalblauw
  "#1F6F66", // teal
  "#B9512F", // terracotta
  "#6E5A86", // pruim
  "#3F7D45", // groen
  "#2F6D9E", // helderblauw
  "#A33E63", // framboos
  "#8A6A2C", // brons
  "#7A3E9D", // paars
  "#B03A3A", // rood
  "#1E7B8C", // cyaan
  "#6B7A28", // mosgroen
  "#C06A1F", // amber
  "#4B5C99", // indigo
] as const;
