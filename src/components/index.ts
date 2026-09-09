/* Design-system components, ported 1:1 from designs/components/**.
   The .prompt.md next to each source file is its original design brief.
   Do not introduce colours, radii or type sizes that are not already a token. */

// core
export { Icon, iconNames, type IconName, type IconProps } from "./core/Icon";
export { Button, type ButtonProps } from "./core/Button";
export { IconButton, type IconButtonProps } from "./core/IconButton";
export { Checkbox, type CheckboxProps } from "./core/Checkbox";
export { Badge, type BadgeProps } from "./core/Badge";

// display
export { Dot, type DotProps, type ProjectSlot } from "./display/Dot";
export { ProgressBar, type ProgressBarProps } from "./display/ProgressBar";
export { MetaChip, type MetaChipProps, type ChipTone } from "./display/MetaChip";
export {
  StatusPill,
  type StatusPillProps,
  type StatusTone,
} from "./display/StatusPill";
export { SectionLabel, type SectionLabelProps } from "./display/SectionLabel";
export { Card, type CardProps } from "./display/Card";
export { FieldRow, type FieldRowProps } from "./display/FieldRow";

// forms
export { SearchInput, type SearchInputProps } from "./forms/SearchInput";
export { FilterChip, type FilterChipProps } from "./forms/FilterChip";
export {
  DateField,
  type DateFieldProps,
  isoToDisplayDate,
  displayToIsoDate,
} from "./forms/DateField";
export { TimeField, type TimeFieldProps, displayToIsoTime } from "./forms/TimeField";

// tasks
export { NavItem, type NavItemProps } from "./tasks/NavItem";
export { ProjectItem, type ProjectItemProps } from "./tasks/ProjectItem";
export {
  ProjectGroupHeader,
  type ProjectGroupHeaderProps,
} from "./tasks/ProjectGroupHeader";
export { TaskRow, type TaskRowProps } from "./tasks/TaskRow";
export { TaskCard, type TaskCardProps } from "./tasks/TaskCard";
export {
  KanbanColumn,
  KanbanDropGhost,
  type KanbanColumnProps,
} from "./tasks/KanbanColumn";
export { BulkBar, type BulkBarProps } from "./tasks/BulkBar";
