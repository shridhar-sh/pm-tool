import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText, Briefcase, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Approvals, Rounds, Deliverables, Projects, Clients, fileUrl, API_BASE } from '@/lib/api';

/**
 * Public, unauthenticated client-review page. The token in the URL is the only
 * thing protecting the decision endpoint.
 *
 * Wire is /r/:token, NOT under DashboardLayout (no sidebar, no auth).
 */
export default function PublicApproval() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | ready | done | error
  const [approval, setApproval] = useState(null);
  const [round, setRound] = useState(null);
  const [deliverable, setDeliverable] = useState(null);
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ap = await Approvals.getByToken(token);
        setApproval(ap);
        if (ap.status !== 'pending') {
          setState('done');
        } else {
          setState('ready');
        }
        // Fetch the linked round + deliverable + project + client for context.
        if (ap.subjectType === 'creative_round') {
          const r = await Rounds.get(ap.subjectId).catch(() => null);
          setRound(r);
          if (r) {
            const ds = await fetch(`${API_BASE}/projects/${ap.projectId}/deliverables`)
              .then(x => x.json()).catch(() => []);
            const d = (ds || []).find(x => x.id === r.deliverableId);
            setDeliverable(d || null);
          }
        }
        const proj = await Projects.get(ap.projectId).catch(() => null);
        setProject(proj);
        if (proj?.clientId) {
          setClient(await Clients.get(proj.clientId).catch(() => null));
        }
      } catch (e) {
        console.error(e);
        setState('error');
      }
    })();
  }, [token]);

  async function decide(decision) {
    if (!name.trim()) return toast.error('Please enter your name first');
    setSubmitting(true);
    try {
      const updated = await Approvals.decideByToken(token, {
        decision,
        decidedBy: name.trim(),
        note: note.trim() || null,
      });
      setApproval(updated);
      setState('done');
      toast.success(decision === 'approved' ? 'Approved' : 'Revisions requested');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />

      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-md flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AgencyPM</p>
            <p className="text-xs text-slate-500">Client review</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {state === 'loading' && <p className="text-slate-500">Loading…</p>}
        {state === 'error' && (
          <Box>
            <p className="font-medium text-slate-900">This link isn't valid.</p>
            <p className="text-sm text-slate-500 mt-2">
              The review may have been cancelled, or the URL was copied incorrectly.
              Please reach out to your AM for a fresh link.
            </p>
          </Box>
        )}
        {(state === 'ready' || state === 'done') && approval && (
          <>
            <Box>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{client?.name || 'Client review'}</p>
              <h1 className="text-2xl font-bold text-slate-900">{deliverable?.name || project?.name || 'Review request'}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {project?.name && deliverable?.name ? `${project.name} · ` : ''}
                {round ? `Round R${round.roundNumber}` : ''}
              </p>
              {approval.note && (
                <p className="mt-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Note from agency</span>
                  {approval.note}
                </p>
              )}
              {round?.files?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assets ({round.files.length})</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {round.files.map(f => <PublicFile key={f.id} file={f} />)}
                  </div>
                </div>
              )}
            </Box>

            {state === 'done' ? (
              <Box className="mt-6">
                <div className="flex items-start gap-3">
                  {approval.status === 'approved'
                    ? <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
                    : <XCircle className="w-6 h-6 text-red-600 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-slate-900">
                      {approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Revisions requested' : approval.status}
                    </p>
                    {approval.decidedBy && (
                      <p className="text-sm text-slate-500 mt-1">By {approval.decidedBy.replace(/^client:/, '')} on {approval.decidedAt?.slice(0, 10)}</p>
                    )}
                    {approval.note && approval.status !== 'pending' && (
                      <p className="text-sm text-slate-700 mt-3">{approval.note}</p>
                    )}
                  </div>
                </div>
              </Box>
            ) : (
              <Box className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-slate-700" />
                  <p className="font-semibold text-slate-900">Your decision</p>
                  <Badge className="text-xs rounded-full border bg-amber-50 text-amber-700 border-amber-200 ml-auto">pending</Badge>
                </div>
                <div className="space-y-3">
                  <Field label="Your name *">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" data-testid="public-name-input" />
                  </Field>
                  <Field label="Notes for the agency (optional)">
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Looks great — ship it." />
                  </Field>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => decide('approved')}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1"
                      data-testid="public-approve-button"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button
                      onClick={() => decide('rejected')}
                      disabled={submitting}
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 flex-1"
                      data-testid="public-reject-button"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Request revisions
                    </Button>
                  </div>
                </div>
              </Box>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PublicFile({ file }) {
  const url = fileUrl(file.url);
  const isImage = (file.mimeType || '').startsWith('image/');
  const isVideo = (file.mimeType || '').startsWith('video/');
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block border border-slate-200 rounded-md p-2 hover:bg-slate-50 transition-colors"
      data-testid={`public-file-${file.id}`}
    >
      <div className="w-full aspect-video bg-slate-100 rounded overflow-hidden flex items-center justify-center">
        {isImage ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <video src={url} className="w-full h-full object-cover" controls />
        ) : (
          <FileText className="w-10 h-10 text-slate-400" />
        )}
      </div>
      <p className="text-sm font-medium text-slate-900 mt-2 truncate">{file.name}</p>
      <p className="text-xs text-slate-500">{file.mimeType || 'file'}</p>
    </a>
  );
}

function Box({ children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
