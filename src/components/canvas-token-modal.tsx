import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CanvasTokenWalkthrough } from "@/components/canvas-token-walkthrough";
import { Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasTokenModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CanvasTokenModal({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: CanvasTokenModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const handleSuccess = () => {
    setOpen(false);
    if (onSuccess) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="glass-inset glass-hover gap-1.5 text-xs rounded-xl"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>How to get your Canvas token</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-none p-0 bg-transparent shadow-none sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Canvas Token Setup Guide</DialogTitle>
          <DialogDescription>
            Step-by-step interactive guide to generate and connect your Canvas access token.
          </DialogDescription>
        </DialogHeader>
        <CanvasTokenWalkthrough onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
