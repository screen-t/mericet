import { Card } from "@/components/ui/card";

interface Props {
  lastActive?: string;
}

export default function ActivityStatus({
  lastActive,
}: Props) {
  return (
    <Card className="p-4 mt-6">
      <h3 className="font-semibold">
        Activity
      </h3>

      <p className="text-sm text-muted-foreground mt-2">
        {lastActive
          ? `Last Active : ${lastActive}`
          : "No activity available"}
      </p>
    </Card>
  );
}