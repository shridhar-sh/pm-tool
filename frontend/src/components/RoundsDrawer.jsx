import { useEffect, useState, useRef } from 'react';
import { Plus, Upload, X, Send, Link as LinkIcon, FileText, Image as ImageIcon, CheckCircle, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Rounds, fileUrl } from '@/lib/api';

const ROUND_STATUS_STYLES = {
  draft:                'bg-slate-50 text-slate-700 border-slate-200',
  internal_review:      'bg-amber-50 text-amber-700 border-amber-200',
  client_review:        'bg-violet-50 text-violet-700 border-violet-200',
  approved:             'bg-green-50 text-green-700 border-green-200',
  revisions_requested:  'bg-red-50 text-red-700 border-red-200',
};

/**
 * Open via `open` + `onOpenChange`. Pass the deliverable for context and the
 * current user so we can stamp uploadedByUserId / requesterUserId correctly.
 */
export default function RoundsDrawer({ open, onOpenChange, deliverable, currentUserId }) {
  const [loading, setLoading] = useState(false);
  const [rounds, setRounds] = useState([]);

  useEffect(() => {
    if (!open || !deliverable) return;
    (async () => {
      setLoading(true);
      try {
        setRounds(await Rounds.listForDeliverable(deliverable.id));
      } catch (e) {
        console.error(e);
        toast.error('Failed to load rounds');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, deliverable?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addRound() {
    try {
      const r = await Rounds.create({
        deliverableId: deliverable.id,
        createdByUserId: currentUserId || null,
      });
      setRounds(prev => [...prev, r]);
      toast.success(`R${r.roundNumber} created`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create round');
    }
  }

  function replaceRound(updated) {
    setRounds(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Creative rounds — {deliverable?.name || ''}</span>
            <Button size="sm" onClick={addRound} className="bg-slate-900 hover:bg-slate-800" data-testid="add-round-button">
              <Plus className="w-4 h-4 mr-2" />New round
            </Button>
          </DialogTitle>
          <DialogDescription>Upload assets, send to client for sign-off, track revisions.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-4">
          {loading ? (
            <p className="text-center py-8 text-slate-500">Loading…</p>
          ) : rounds.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No rounds yet. Click "New round" to start R1.</p>
          ) : (
            rounds.map(r => (
              <RoundCard
                key={r.id}
                round={r}
                currentUserId={currentUserId}
                onChanged={replaceRound}
                onDeleted={(id) => setRounds(prev => prev.filter(x => x.id !== id))}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoundCard({ round, currentUserId, onChanged, onDeleted }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState(round.notes || '');
  const [sending, setSending] = useState(false);

  async function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const updated = await Rounds.uploadFile(round.id, f, currentUserId);
      onChanged(updated);
      toast.success(`Uploaded ${f.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeFile(fileId) {
    if (!window.confirm('Remove this file?')) return;
    try {
      const updated = await Rounds.deleteFile(round.id, fileId);
      onChanged(updated);
    } catch (e) {
      console.error(e);
      toast.error('Failed to remove file');
    }
  }

  async function saveNotes() {
    try {
      const updated = await Rounds.update(round.id, { notes });
      onChanged(updated);
      toast.success('Notes saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save notes');
    }
  }

  async function sendToClient() {
    if (!round.files?.length) return toast.error('Upload at least one file first');
    if (!currentUserId) return toast.error('No current user — relogin');
    setSending(true);
    try {
      const updated = await Rounds.sendToClient(round.id, {
        requesterUserId: currentUserId,
        note: notes || null,
      });
      onChanged(updated);
      toast.success('Sent to client');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function deleteRound() {
    if (!window.confirm(`Delete R${round.roundNumber} and all its files?`)) return;
    try {
      await Rounds.delete(round.id);
      onDeleted(round.id);
      toast.success(`R${round.roundNumber} deleted`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete round');
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3" data-testid={`round-${round.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-900">R{round.roundNumber}</span>
          <Badge className={`text-xs rounded-full border ${ROUND_STATUS_STYLES[round.status] || ROUND_STATUS_STYLES.draft}`}>
            {round.status.replace('_', ' ')}
          </Badge>
          {round.status === 'approved' && <CheckCircle className="w-4 h-4 text-green-600" />}
        </div>
        <Button variant="ghost" size="sm" onClick={deleteRound} className="text-red-600 hover:bg-red-50">Delete</Button>
      </div>

      {round.files?.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {round.files.map(f => (
            <FilePreview key={f.id} file={f} onRemove={() => removeFile(f.id)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No files yet.</p>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onPickFile}
          data-testid={`upload-input-${round.id}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid={`upload-button-${round.id}`}
        >
          {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? 'Uploading…' : 'Upload file'}
        </Button>

        {round.status === 'draft' && (
          <Button
            size="sm"
            className="bg-slate-900 hover:bg-slate-800"
            onClick={sendToClient}
            disabled={sending || !round.files?.length}
            data-testid={`send-client-${round.id}`}
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Sending…' : 'Send to client'}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for the reviewer…"
          data-testid={`round-notes-${round.id}`}
        />
        {notes !== (round.notes || '') && (
          <Button size="sm" variant="outline" onClick={saveNotes}>Save notes</Button>
        )}
      </div>

      {round.clientMagicLinkToken && (round.status === 'client_review' || round.status === 'approved' || round.status === 'revisions_requested') && (
        <MagicLinkRow token={round.clientMagicLinkToken} />
      )}
    </div>
  );
}

function FilePreview({ file, onRemove }) {
  const url = fileUrl(file.url);
  const isImage = (file.mimeType || '').startsWith('image/');
  return (
    <div className="border border-slate-200 rounded-md p-2 flex items-center gap-3">
      <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
        {isImage
          ? <img src={url} alt={file.name} className="w-full h-full object-cover" />
          : <FileText className="w-6 h-6 text-slate-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-900 truncate block hover:underline">
          {file.name}
        </a>
        <p className="text-xs text-slate-500">{formatBytes(file.sizeBytes)} · {file.mimeType || 'file'}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-red-600 hover:bg-red-50">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function MagicLinkRow({ token }) {
  const link = `${window.location.origin}/r/${token}`;
  function copy() {
    navigator.clipboard?.writeText(link);
    toast.success('Link copied');
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-center gap-2">
      <LinkIcon className="w-4 h-4 text-slate-500 shrink-0" />
      <span className="text-xs text-slate-600 truncate flex-1 font-mono">{link}</span>
      <Button size="sm" variant="outline" onClick={copy}>Copy</Button>
    </div>
  );
}

function formatBytes(n) {
  if (!n) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
