import { ViewHeader } from "./ViewHeader";
import { EmptyState } from "./EmptyState";

/** A destination with a title and a placeholder body — used for the five
 *  non-Taken destinations until their features land. */
export function SimpleView({
  title,
  label,
  message,
}: {
  title: string;
  label: string;
  message: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <ViewHeader title={title} />
      <EmptyState label={label} message={message} />
    </div>
  );
}
