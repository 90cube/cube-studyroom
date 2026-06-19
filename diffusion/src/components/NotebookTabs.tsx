// Switches between a part's notebooks via tabs (or renders the single one).
// Local UI-only state: the active notebook id.

import { useState } from "react";
import { FileText } from "lucide-react";
import type { Part } from "@/models/curriculum";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotebookViewer } from "@/components/NotebookViewer";

export function NotebookTabs({ part }: { part: Part }) {
  const first = part.notebooks[0]?.id ?? "";
  const [active, setActive] = useState(first);

  if (part.notebooks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        이 파트에는 노트북이 없습니다.
      </p>
    );
  }

  if (part.notebooks.length === 1) {
    return <NotebookViewer id={part.notebooks[0].id} />;
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList className="mb-5 flex-wrap">
        {part.notebooks.map((nb) => (
          <TabsTrigger key={nb.id} value={nb.id}>
            <FileText className="mr-1 size-3.5" />
            {nb.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <NotebookViewer id={active} />
    </Tabs>
  );
}
