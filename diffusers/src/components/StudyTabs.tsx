// Switches between a part's study docs via tabs (or renders the single one).
// Local UI-only state: the active doc id.

import { useState } from "react";
import { FileText } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudyViewer } from "@/components/StudyViewer";

export function StudyTabs({ part }: { part: Part }) {
  const first = part.notebooks[0]?.id ?? "";
  const [active, setActive] = useState(first);

  if (part.notebooks.length === 0) {
    return <p className="text-sm text-muted-foreground">이 파트는 아직 준비 중이에요.</p>;
  }

  if (part.notebooks.length === 1) {
    return <StudyViewer id={part.notebooks[0].id} />;
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList className="mb-5 flex-wrap">
        {part.notebooks.map((d) => (
          <TabsTrigger key={d.id} value={d.id}>
            <FileText className="mr-1 size-3.5" />
            {d.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <StudyViewer id={active} />
    </Tabs>
  );
}
