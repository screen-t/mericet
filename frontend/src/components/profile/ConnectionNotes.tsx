import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { backendApi } from "@/lib/backend-api";

interface Props {
  userId: string;
}

export default function ConnectionNotes({ userId }: Props) {
  const [notes, setNotes] = useState("");

  const save = async () => {
    try {
      await backendApi.profile.saveConnectionNotes(userId, notes);

      alert("Saved");
    } catch {
      alert("Backend not implemented yet.");
    }
  };

  return (
    <Card className="p-5 mt-6">
      <h3 className="font-semibold text-lg mb-4">
        Private Notes
      </h3>

      <Textarea
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Write notes about this connection..."
      />

      <Button
        className="mt-4"
        onClick={save}
      >
        Save Notes
      </Button>
    </Card>
  );
}