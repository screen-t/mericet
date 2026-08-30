import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Suspended = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <Card className="max-w-md w-full p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Account suspended</h1>
        <p className="mt-3 text-muted-foreground">
          Your account has been suspended for violating our community guidelines.
          If you believe this is a mistake, please contact support.
        </p>
        <Button asChild className="mt-6">
          <Link to="/login">Back to login</Link>
        </Button>
      </Card>
    </div>
  );
};

export default Suspended;
