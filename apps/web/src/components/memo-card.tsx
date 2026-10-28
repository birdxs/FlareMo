import type { Editor } from "@tiptap/react";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import type { Attachment, Memo, MemoVisibility, Share } from "@/api";
import { MemoCardBody } from "@/components/memo-card/memo-card-body";
import { MemoCardEditor } from "@/components/memo-card/memo-card-editor";
import { MemoCardHeader } from "@/components/memo-card/memo-card-header";
import { useMemoCardActions } from "@/components/memo-card/use-memo-card-actions";
import { cn } from "@/lib/utils";

type MemoCardProps = {
  memo: Memo;
  attachments: Attachment[];
  onArchive: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  /** Creates (or reuses) the memo's public share and resolves with it, so a
      caller that has no share yet can still obtain the token in one step. */
  onShare: (id: string) => Promise<Share>;
  /** Tear down the public link after a memo leaves "public". */
  onRevokeShare?: (share: Share) => void;
  onUpdate: (
    id: string,
    input: { content: string; visibility: MemoVisibility },
  ) => Promise<void>;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => Promise<void>;
  share?: Share;
  searchQuery?: string;
  /** Position in the list, used to stagger the entrance animation. */
  index?: number;
  /** Called when a tag chip is clicked to filter the timeline by that tag. */
  onTagClick?: (tag: string) => void;
  canManage?: boolean;
  /** Lifecycle governance (archive/trash/restore) without content editing. */
  canGovern?: boolean;
  /** Focused via J/K keyboard navigation. */
  isFocused?: boolean;
  onRequestDelete?: (memo: Memo) => void;
  onRequestShareImage?: (memo: Memo) => void;
  onRequestVisibility?: (memo: Memo) => void;
  /**
   * Reports whether this card holds unsaved editor state. The virtualized
   * timeline uses it to keep such a card mounted: unmounting mid-edit would
   * discard the draft the user is still typing.
   */
  onEditingChange?: (memoName: string, editing: boolean) => void;
};

export const MemoCard = memo(function MemoCard({
  memo,
  attachments,
  onArchive,
  onPin,
  onShare,
  onRevokeShare,
  onUpdate,
  onTrash,
  onRestore,
  onHardDelete,
  share,
  searchQuery,
  index = 0,
  onTagClick,
  canManage = false,
  canGovern = false,
  isFocused = false,
  onRequestDelete,
  onRequestShareImage,
  onRequestVisibility,
  onEditingChange,
}: MemoCardProps) {
  // Expansion is per-card and resets on remount; it outlives an edit
  // round-trip, so it stays above the body/editor switch.
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [draftContent, setDraftContent] = useState(memo.content);
  // Card-owned, like the states above: an upload that outlives the editor
  // session (Esc while a paste is still settling) keeps its target.
  const editEditorRef = useRef<Editor | null>(null);
  const isTrashed = memo.state === "trashed";

  // The virtualized list may unmount a card at any scroll offset. While the
  // editor is open that would throw away the draft, so every write to
  // `isEditing` — including the one inside useMemoCardActions' save path —
  // goes through this wrapper, which reports the state to the list.
  const setEditing = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      setIsEditing((previous) => {
        const next = typeof value === "function" ? value(previous) : value;
        if (next !== previous) onEditingChange?.(memo.name, next);
        return next;
      });
    },
    [memo.name, onEditingChange],
  );

  const { changeVisibility, id, prefetchDetail, saveEditing, taskInteraction } =
    useMemoCardActions({
      canManage,
      draftContent,
      isTrashed,
      memo,
      onRevokeShare,
      onShare,
      onUpdate,
      share,
      setIsEditing: setEditing,
      setIsSaving,
    });

  const startEditing = () => {
    setDraftContent(memo.content);
    setEditing(true);
  };

  const stopEditing = () => setEditing(false);
  const beginEditing = startEditing;

  return (
    <article
      data-memo-id={memo.id}
      className={cn(
        "group relative flex w-full flex-col gap-2 rounded-xl border border-border/50 bg-card/60 px-3.5 py-4 text-card-foreground [content-visibility:auto] [contain-intrinsic-size:auto_120px] motion-safe:animate-rise motion-safe:transition-[background-color,border-color,transform,box-shadow] motion-safe:duration-150 hover:border-border hover:bg-card hover:shadow-xs motion-safe:hover:-translate-y-px",
        memo.pinned &&
          "border-l-brand-500 border-l-[3px] dark:border-l-brand-400 bg-card",
        isFocused && "ring-2 ring-brand-400/60 shadow-xs bg-card",
        isEditing && "bg-card shadow-xs ring-1 ring-brand-400/40",
      )}
      style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
    >
      <MemoCardHeader
        memo={memo}
        id={id}
        isTrashed={isTrashed}
        canManage={canManage}
        canGovern={canGovern}
        prefetchDetail={prefetchDetail}
        onArchive={onArchive}
        onHardDelete={onHardDelete}
        onPin={onPin}
        onRestore={onRestore}
        onStartEditing={beginEditing}
        onTrash={onTrash}
        share={share}
        onShare={onShare}
        onRevokeShare={onRevokeShare}
        onUpdateVisibility={changeVisibility}
        onRequestDelete={onRequestDelete}
        onRequestShareImage={onRequestShareImage}
        onRequestVisibility={onRequestVisibility}
      />
      {isEditing ? (
        <MemoCardEditor
          content={draftContent}
          isSaving={isSaving}
          isUploadingInline={isUploadingInline}
          setIsUploadingInline={setIsUploadingInline}
          editorRef={editEditorRef}
          memoName={memo.name}
          onCancel={stopEditing}
          onContentChange={setDraftContent}
          onSave={saveEditing}
        />
      ) : (
        <MemoCardBody
          attachments={attachments}
          canManage={canManage}
          expanded={expanded}
          memo={memo}
          onTagClick={onTagClick}
          onToggleExpanded={() => setExpanded((value) => !value)}
          searchQuery={searchQuery}
          taskInteraction={taskInteraction}
        />
      )}
    </article>
  );
});
