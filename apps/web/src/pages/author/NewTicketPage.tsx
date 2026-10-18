import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ATTACHMENT_RULES, attachmentSchema, createTicketSchema, type AttachmentInput } from '@bookleaf/shared';
import { ApiError, errorMessage } from '../../api/client';
import { api, keys } from '../../api/endpoints';
import { PaperclipIcon } from '../../components/Thread';
import { Banner, Button, Card, Field, PageHeader, inputClass } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { fieldErrors } from '../../lib/validation';

const GENERAL = '__general__';

export function NewTicketPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const books = useQuery({ queryKey: keys.books, queryFn: api.books });

  const [bookId, setBookId] = useState(params.get('book') ?? '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<AttachmentInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: api.createTicket,
    onSuccess: (ticket) => {
      void qc.invalidateQueries({ queryKey: keys.tickets });
      navigate(`/tickets/${ticket.id}`, { state: { justCreated: true } });
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
    },
  });

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const candidate = { fileName: file.name, sizeBytes: file.size, mimeType: file.type };
    const check = attachmentSchema.safeParse(candidate);
    if (!check.success) {
      setErrors((prev) => ({ ...prev, attachment: check.error.issues[0]?.message ?? 'Unsupported file' }));
      setAttachment(null);
      e.target.value = '';
      return;
    }
    setErrors(({ attachment: _omit, ...rest }) => rest);
    setAttachment(check.data);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      bookId: bookId === GENERAL ? null : bookId,
      subject,
      description,
      ...(attachment ? { attachment } : {}),
    };
    const parsed = createTicketSchema.safeParse(input);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (!bookId) next.bookId = 'Choose a book, or "General / Account Level"';
    if (!parsed.success || Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  }

  return (
    <div>
      <PageHeader eyebrow="Support" title="Get help" subtitle="Tell us what's going on and the BookLeaf team will get back to you, usually within 48 hours." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,52rem)_24rem]">
        <Card className="p-6 sm:p-8">
          <form className="space-y-5" onSubmit={submit} noValidate>
            {create.isError && !(create.error instanceof ApiError && create.error.status === 422) && (
              <Banner tone="error">{errorMessage(create.error, 'Could not submit your ticket.')}</Banner>
            )}

            <Field label="What is this about?" htmlFor="book" error={errors.bookId}>
              <select
                id="book"
                className={inputClass}
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                disabled={books.isPending}
                aria-invalid={!!errors.bookId}
              >
                <option value="" disabled>
                  {books.isPending ? 'Loading your books…' : 'Select a book…'}
                </option>
                {books.data?.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.isPublished ? '' : `(in production: ${b.productionStage})`}
                  </option>
                ))}
                <option value={GENERAL}>General / Account Level</option>
              </select>
            </Field>

            <Field label="Subject" htmlFor="subject" error={errors.subject} hint="A short summary, e.g. “Royalty for Q3 not received”">
              <input
                id="subject"
                className={inputClass}
                value={subject}
                maxLength={150}
                onChange={(e) => setSubject(e.target.value)}
                aria-invalid={!!errors.subject}
              />
            </Field>

            <Field
              label="Details"
              htmlFor="description"
              error={errors.description}
              hint="Include dates, platforms, order numbers or anything else that helps us look into it quickly."
            >
              <textarea
                id="description"
                rows={7}
                className={inputClass}
                value={description}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
              />
            </Field>

            <Field label="Attachment (optional)" htmlFor="attachment" error={errors.attachment} hint="Photos of print defects, screenshots of listings. JPG, PNG, WEBP or PDF up to 5 MB.">
              <input
                ref={fileInput}
                id="attachment"
                type="file"
                className="sr-only"
                accept={ATTACHMENT_RULES.mimeTypes.join(',')}
                onChange={onFile}
              />
              {attachment ? (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span className="flex items-center gap-2 truncate text-slate-700">
                    <PaperclipIcon /> {attachment.fileName}
                    <span className="text-xs text-slate-400">{formatBytes(attachment.sizeBytes)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAttachment(null);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  <PaperclipIcon /> Choose file
                </Button>
              )}
            </Field>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <Link to="/tickets" className="text-sm text-slate-600 hover:underline">
                Cancel
              </Link>
              <Button type="submit" loading={create.isPending}>
                Submit ticket
              </Button>
            </div>
          </form>
        </Card>
        <HelpPanel />
      </div>
    </div>
  );
}

const NEXT_STEPS = [
  ['We sort it straight away', 'Your ticket is categorised and prioritised the moment you submit it, so urgent issues reach the right person first.'],
  ['A team member reviews it', 'Someone from BookLeaf reads your question alongside your book and royalty details.'],
  ['You get a reply here', 'Usually within 48 hours. You will see it on this portal as soon as it is sent, no refresh needed.'],
];

function HelpPanel() {
  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">What happens next</h2>
        <ol className="mt-4 space-y-4">
          {NEXT_STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{i + 1}</span>
              <span className="text-sm">
                <span className="block font-medium text-slate-800">{title}</span>
                <span className="text-slate-500">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <div className="rounded-2xl bg-gold-100/60 p-6 ring-1 ring-gold-100">
        <h2 className="text-lg font-semibold text-slate-900">For a faster answer</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Pick the book the question is about.</li>
          <li>Royalty questions: mention the quarter or payout date.</li>
          <li>Print issues: attach a photo of the affected pages.</li>
          <li>Listing issues: name the platform (Amazon, Flipkart…).</li>
        </ul>
      </div>
    </aside>
  );
}
