import type { Editor } from "@tiptap/react";
import {
  CalendarPlusIcon,
  HashIcon,
  ImagePlusIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  Maximize2Icon,
  MicIcon,
} from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { loadComposerFocusCanvas } from "@/components/composer/composer-focus-canvas-lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { todayKey } from "@/lib/calendar-date";
import { cn } from "@/lib/utils";

/**
 * One composer tool: a quiet 28px ghost button whose icon sits in muted ink
 * and darkens on hover. The label is both the accessible name and a delayed
 * tooltip, so every tool explains itself the same way (previously only two
 * of the eight had a `title`).
 */
function ToolButton({
  label,
  active,
  render,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "render"> & {
  label: string;
  active?: boolean;
  render?: ReactElement;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={450}
        render={
          <Button
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "text-muted-foreground hover:text-foreground aria-pressed:bg-accent aria-pressed:text-primary",
              className,
            )}
            render={render}
            size="icon-sm"
            type={render ? undefined : "button"}
            variant="ghost"
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:block"
    />
  );
}

/**
 * Formatting rail of the composer, in three groups: insert (tag, image),
 * structure (lists), and capture (date, voice, fullscreen). It is the left
 * half of the composer's bottom bar, next to the visibility menu and send.
 * Every editor action goes through `withEditor`, which no-ops while a
 * submission is pending.
 */
export function ComposerToolbar({
  isPending,
  voiceActive,
  captureAvailable,
  withEditor,
  onAddFiles,
  onStartVoice,
  onExpand,
}: {
  isPending: boolean;
  voiceActive: boolean;
  captureAvailable: boolean;
  withEditor: (action: (editor: Editor) => void) => void;
  /**
   * Files picked through the attachment button. The caller appends them to
   * its latest draft (not a render-time copy), so an inline upload landing in
   * between is never overwritten.
   */
  onAddFiles: (files: File[]) => void;
  /** Starts a session; the caller owns the controller. */
  onStartVoice: () => void;
  /** Opens fullscreen focus canvas. */
  onExpand?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToolButton
        disabled={isPending}
        label={t("composer.addTag")}
        onClick={() =>
          withEditor((editor) => {
            editor
              .chain()
              .focus()
              .insertContentAt(editor.state.selection.to, "#")
              .run();
          })
        }
      >
        <HashIcon />
      </ToolButton>
      <ToolButton
        disabled={isPending}
        label={t("composer.addAttachment")}
        render={
          <label
            aria-label={t("composer.addAttachment")}
            htmlFor="flaremo-attachment-input"
          />
        }
      >
        <ImagePlusIcon />
        <Input
          className="hidden"
          disabled={isPending}
          id="flaremo-attachment-input"
          multiple
          type="file"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length === 0) return;
            onAddFiles(files);
          }}
        />
      </ToolButton>
      <ToolDivider />
      <ToolButton
        disabled={isPending}
        label={t("composer.bulletList")}
        onClick={() =>
          withEditor((editor) => {
            editor.chain().focus().toggleBulletList().run();
          })
        }
      >
        <ListIcon />
      </ToolButton>
      <ToolButton
        disabled={isPending}
        label={t("composer.orderedList")}
        onClick={() =>
          withEditor((editor) => {
            editor.chain().focus().toggleOrderedList().run();
          })
        }
      >
        <ListOrderedIcon />
      </ToolButton>
      <ToolButton
        disabled={isPending}
        label={t("composer.taskList")}
        onClick={() =>
          withEditor((editor) => {
            editor.chain().focus().toggleTaskList().run();
          })
        }
      >
        <ListTodoIcon />
      </ToolButton>
      <ToolDivider />
      <ToolButton
        disabled={isPending}
        label={t("composer.insertDate")}
        onClick={() =>
          withEditor((editor) => {
            const today = todayKey();
            editor.chain().focus().insertContent(`${today} `).run();
          })
        }
      >
        <CalendarPlusIcon />
      </ToolButton>
      {captureAvailable && (
        <ToolButton
          active={voiceActive}
          disabled={isPending}
          label={t("composer.voice")}
          onClick={() => {
            if (voiceActive) return;
            onStartVoice();
          }}
        >
          <MicIcon />
        </ToolButton>
      )}
      {onExpand && (
        <ToolButton
          disabled={isPending}
          label={t("composer.fullscreen.open")}
          onClick={onExpand}
          onMouseEnter={() => {
            void loadComposerFocusCanvas();
          }}
        >
          <Maximize2Icon />
        </ToolButton>
      )}
    </div>
  );
}
