"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasValidConsent, recordConsent } from "@/lib/consent";

interface ConsentGateProps {
  /** Rendered once the user has given (or previously gave) consent. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Blocks camera/recording UI until the user explicitly consents to having
 * their video and audio processed for pitch analysis by Interhuman AI, the
 * resulting text transcript sent to OpenAI for content scoring, and the
 * recording used under Interhuman's Model Improvement Program (always on for
 * this app, not user-toggleable). Required before any getUserMedia()/recording
 * call — see src/lib/consent.ts for storage details.
 *
 * This is a layered notice: it states the controller, each processing purpose,
 * what data is involved, and the right to withdraw, then links to /privacy for
 * the detail (streaming vs. upload-fallback mechanics, immediate deletion,
 * automated redaction, withdrawal caveats). Keep the MIP disclosure inline
 * rather than behind the docs link — training is a separate purpose from
 * analysis, so consent to it has to be informed here, and CONSENT_VERSION can
 * only version text we control.
 *
 * The disclosure is shown in a modal dialog, but children are *not* rendered
 * behind it while consent is pending: <VideoRecorder> opens the camera on
 * mount, so mounting it under the dialog would touch the camera before the
 * user agreed. Instead a placeholder sits behind the dialog, which re-opens
 * it if the user dismisses the dialog without agreeing.
 */
export function ConsentGate({ children, className }: ConsentGateProps) {
  // Start as "unknown" (null) so we don't flash the consent dialog for users
  // who already consented — we only know once we've checked localStorage.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const valid = hasValidConsent();
    setConsented(valid);
    setOpen(!valid);
  }, []);

  const handleAccept = () => {
    if (!checked) return;
    recordConsent();
    setConsented(true);
    setOpen(false);
  };

  if (consented === null) {
    // Brief check of localStorage — render nothing rather than flashing the
    // consent dialog then immediately hiding it.
    return null;
  }

  if (consented) {
    return <>{children}</>;
  }

  return (
    <div className={className}>
      <div className="max-w-2xl mx-auto rounded-lg border border-dashed border-primary/30 bg-secondary/20 px-6 py-12 text-center">
        <Camera className="w-8 h-8 text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
          We need your consent before turning on your camera and microphone.
        </p>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Review &amp; continue
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Before you record</DialogTitle>
            <DialogDescription className="sr-only">
              How your recording is processed, and what you&apos;re agreeing to
              before we access your camera and microphone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-secondary/40 rounded-lg p-4 space-y-2.5 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <a
                  href="https://interhuman.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Interhuman AI
                </a>{" "}
                analyzes your video and audio; OpenAI scores your transcript.
                We never keep your recording — only the transcript, scores, and
                feedback.
              </span>
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Interhuman also uses your recording — to
                train their models under their{" "}
                <a
                  href="https://docs.interhuman.ai/explanations/model-improvement-program"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Model Improvement Program
                </a>
                . Always on for this app, no opt-out, kept up to 18 months.
              </span>
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                You can withdraw consent at any time. Full detail in our{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-input accent-primary shrink-0"
            />
            <span className="text-sm">
              I&apos;m 18 or older, and will record only myself or have
              permission from anyone else in the recording. I consent to the
              processing described above, including Model Improvement Program
              use, as set out in the{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              .
            </span>
          </label>

          <Button
            size="lg"
            className="w-full"
            disabled={!checked}
            onClick={handleAccept}
          >
            Agree &amp; Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
